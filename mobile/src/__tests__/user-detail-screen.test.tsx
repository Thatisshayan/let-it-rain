import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const authContextMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const permissionsMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
}));

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

const settingsMocks = vi.hoisted(() => ({
  fetchUsers: vi.fn(),
  updateUserPermissions: vi.fn(),
  setUserActive: vi.fn(),
  resetUserPassword: vi.fn(),
  ALL_PERMISSIONS: ["MANAGE_USERS", "EDIT_ITEMS"],
}));

const routeMocks = vi.hoisted(() => ({
  useLocalSearchParams: vi.fn(),
}));

const queryClientMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

class MockApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function MockText({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockTextInput() {
  return null;
}

function MockPressable({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../lib/permissions", () => permissionsMocks);
vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../api/settings", () => settingsMocks);
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
vi.mock("expo-router", () => routeMocks);
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderUserDetailScreen() {
  const UserDetailScreen = (await import("../../app/settings/users/[id]")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<UserDetailScreen />);
  });

  return tree!;
}

describe("user detail screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "admin-1", permissions: ["MANAGE_USERS"] },
    });
    permissionsMocks.hasPermission.mockReturnValue(true);
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      mutedForeground: "#777",
      destructive: "#f33",
      success: "#0f0",
      primary: "#09f",
      primaryForeground: "#111",
    });
    routeMocks.useLocalSearchParams.mockReturnValue({ id: "user-2" });
    queryClientMocks.invalidateQueries.mockResolvedValue(undefined);
    queryMocks.useQueryClient.mockReturnValue(queryClientMocks);
    queryMocks.useQuery.mockReturnValue({
      data: [
        { id: "user-2", name: "Bob", email: "bob@example.com", active: true, permissions: ["EDIT_ITEMS"] },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("shows a local deny state when the user lacks MANAGE_USERS", async () => {
    permissionsMocks.hasPermission.mockReturnValue(false);

    const tree = await renderUserDetailScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to manage users." })).toHaveLength(1);
  });

  it("shows load error and retries when requested", async () => {
    const refetch = vi.fn();
    queryMocks.useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("nope"),
      refetch,
    });

    const tree = await renderUserDetailScreen();
    const retryButton = tree.root.findByType(MockPressable);

    expect(tree.root.findAllByProps({ children: "Could not load this user." })).toHaveLength(1);

    await act(async () => {
      retryButton.props.onPress();
    });

    expect(refetch).toHaveBeenCalled();
  });

  it("shows not found when the requested user is missing from the query result", async () => {
    queryMocks.useQuery.mockReturnValue({
      data: [{ id: "other-user", name: "Alice", email: "a@example.com", active: true, permissions: [] }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const tree = await renderUserDetailScreen();

    expect(tree.root.findAllByProps({ children: "User not found." })).toHaveLength(1);
  });

  it("saves permissions and invalidates the users query", async () => {
    settingsMocks.updateUserPermissions.mockResolvedValue(undefined);

    const tree = await renderUserDetailScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const togglePermButton = buttons[0];
    const savePermissionsButton = buttons[2];

    await act(async () => {
      togglePermButton.props.onPress();
    });

    await act(async () => {
      await savePermissionsButton.props.onPress();
    });

    expect(settingsMocks.updateUserPermissions).toHaveBeenCalledWith("user-2", ["EDIT_ITEMS", "MANAGE_USERS"]);
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["users"] });
  });

  it("toggles active status and invalidates the users query", async () => {
    settingsMocks.setUserActive.mockResolvedValue(undefined);

    const tree = await renderUserDetailScreen();
    const toggleActiveButton = tree.root.findAllByType(MockPressable)[3];

    await act(async () => {
      await toggleActiveButton.props.onPress();
    });

    expect(settingsMocks.setUserActive).toHaveBeenCalledWith("user-2", false);
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["users"] });
  });

  it("resets the password and clears the input", async () => {
    settingsMocks.resetUserPassword.mockResolvedValue(undefined);

    const tree = await renderUserDetailScreen();
    const passwordInput = tree.root.findByType(MockTextInput);
    const resetPasswordButton = tree.root.findAllByType(MockPressable)[4];

    await act(async () => {
      passwordInput.props.onChangeText("new-secret");
    });

    await act(async () => {
      await resetPasswordButton.props.onPress();
    });

    expect(settingsMocks.resetUserPassword).toHaveBeenCalledWith("user-2", "new-secret");
    expect(passwordInput.props.value).toBe("");
  });
});
