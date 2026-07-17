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
}));

const settingsMocks = vi.hoisted(() => ({
  fetchUsers: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

function MockText({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockPressable({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockFlatList({
  data,
  renderItem,
}: {
  data: Array<{ id: string; name: string; active: boolean }>;
  renderItem: (info: { item: { id: string; name: string; active: boolean } }) => React.ReactNode;
}) {
  return (
    <>
      {data.map((item) => (
        <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
      ))}
    </>
  );
}

vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../lib/permissions", () => permissionsMocks);
vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../api/settings", () => settingsMocks);
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  FlatList: MockFlatList,
  Pressable: MockPressable,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderUsersScreen() {
  const UsersScreen = (await import("../../app/settings/users/index")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<UsersScreen />);
  });

  return tree!;
}

describe("users screen", () => {
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
      success: "#0f0",
      primary: "#09f",
      primaryForeground: "#111",
    });
    queryMocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("shows a local deny state when the user lacks MANAGE_USERS", async () => {
    permissionsMocks.hasPermission.mockReturnValue(false);

    const tree = await renderUsersScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to manage users." })).toHaveLength(1);
  });

  it("shows query errors and retries when requested", async () => {
    const refetch = vi.fn();
    queryMocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("nope"),
      refetch,
    });

    const tree = await renderUsersScreen();
    const retryButton = tree.root.findAllByType(MockPressable)[0];

    expect(tree.root.findAllByProps({ children: "Could not load users." })).toHaveLength(1);

    await act(async () => {
      retryButton.props.onPress();
    });

    expect(refetch).toHaveBeenCalled();
  });

  it("navigates to a user detail row and to the new-user screen", async () => {
    queryMocks.useQuery.mockReturnValue({
      data: [
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const tree = await renderUsersScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const firstUserRow = buttons[0];
    const newUserButton = buttons[2];

    await act(async () => {
      firstUserRow.props.onPress();
      newUserButton.props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/settings/users/u1");
    expect(routerMocks.push).toHaveBeenCalledWith("/settings/users/new");
  });
});
