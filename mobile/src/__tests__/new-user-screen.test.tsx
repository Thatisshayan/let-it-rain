import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const settingsMocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  ALL_PERMISSIONS: ["MANAGE_USERS", "EDIT_ITEMS"],
}));

const authContextMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const permissionsMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  show: vi.fn(),
}));

const queryClientMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
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

vi.mock("../api/settings", () => settingsMocks);
vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../lib/permissions", () => permissionsMocks);
vi.mock("../toast", () => ({
  useToast: () => toastMocks,
}));
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => queryClientMocks,
}));
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderNewUserScreen() {
  const NewUserScreen = (await import("../../app/settings/users/new")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<NewUserScreen />);
  });

  return tree!;
}

describe("new user screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["MANAGE_USERS"] },
    });
    permissionsMocks.hasPermission.mockReturnValue(true);
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      mutedForeground: "#777",
      destructive: "#f33",
      primary: "#09f",
      primaryForeground: "#111",
    });
    queryClientMocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it("shows a local deny state when the user lacks MANAGE_USERS", async () => {
    permissionsMocks.hasPermission.mockReturnValue(false);

    const tree = await renderNewUserScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to create users." })).toHaveLength(1);
  });

  it("creates a user, invalidates the users query, shows a toast, and navigates back", async () => {
    settingsMocks.createUser.mockResolvedValue(undefined);

    const tree = await renderNewUserScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const permToggle = tree.root.findAllByType(MockPressable)[0];
    const submitButton = tree.root.findAllByType(MockPressable)[2];

    await act(async () => {
      inputs[0].props.onChangeText("Bob");
      inputs[1].props.onChangeText("bob@example.com");
      inputs[2].props.onChangeText("secret123");
      permToggle.props.onPress();
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(settingsMocks.createUser).toHaveBeenCalledWith({
      name: "Bob",
      email: "bob@example.com",
      password: "secret123",
      permissions: ["MANAGE_USERS"],
    });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["users"] });
    expect(toastMocks.show).toHaveBeenCalledWith("User created");
    expect(routerMocks.back).toHaveBeenCalled();
  });

  it("shows the API error message when create user fails", async () => {
    settingsMocks.createUser.mockRejectedValue(new MockApiError(400, "Email already exists"));

    const tree = await renderNewUserScreen();
    const submitButton = tree.root.findAllByType(MockPressable)[2];

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "Email already exists" })).toHaveLength(1);
    expect(routerMocks.back).not.toHaveBeenCalled();
  });
});
