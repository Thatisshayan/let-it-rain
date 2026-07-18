import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

const authContextMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const permissionsMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
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
  ListHeaderComponent,
  refreshControl,
}: {
  ListHeaderComponent?: React.ReactNode;
  refreshControl?: React.ReactNode;
}) {
  return (
    <>
      {refreshControl}
      {ListHeaderComponent}
    </>
  );
}

function MockRefreshControl() {
  return null;
}

vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../../src/api/AuthContext", () => authContextMocks);
vi.mock("../../src/lib/permissions", () => permissionsMocks);
vi.mock("../../src/theme", () => themeMocks);
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("../../src/api/reports", () => ({
  fetchReports: vi.fn(),
  formatMoney: (value: number) => `$${value.toFixed(2)}`,
}));
vi.mock("../../src/api/items", () => ({
  fetchItems: vi.fn(),
}));
vi.mock("../../src/api/activity", () => ({
  fetchActivity: vi.fn(),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  Pressable: MockPressable,
  FlatList: MockFlatList,
  RefreshControl: MockRefreshControl,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderDashboardScreen() {
  const DashboardScreen = (await import("../../app/(tabs)/dashboard")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<DashboardScreen />);
  });

  return tree!;
}

describe("dashboard screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["VIEW_REPORTS"] },
    });
    permissionsMocks.hasPermission.mockImplementation((user, permission: string) =>
      user?.permissions?.includes(permission) ?? false
    );
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      mutedForeground: "#777",
      destructive: "#f33",
      primary: "#09f",
      primaryForeground: "#111",
      warning: "#fc0",
      warningBackground: "#331",
      card: "#111",
    });
    queryMocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    });
    queryMocks.useQuery.mockImplementation(({ queryKey, enabled }) => {
      if (queryKey[0] === "reports") {
        if (enabled === false) {
          return { data: undefined, isRefetching: false };
        }
        return {
          data: { todayRevenue: 42 },
          isRefetching: false,
        };
      }

      if (queryKey[0] === "items") {
        return {
          data: [
            { id: "i1", name: "Rice", quantity: 1, minStock: 5 },
            { id: "i2", name: "Beans", quantity: 0, minStock: 4 },
          ],
          isRefetching: false,
        };
      }

      return {
        data: {
          movements: [
            { id: "m1", itemName: "Rice", type: "REMOVE", delta: -1, userName: "Alice" },
            { id: "m2", itemName: "Beans", type: "RECEIVE", delta: 5, userName: "Bob" },
          ],
        },
        isRefetching: false,
      };
    });
  });

  it("shows the revenue card only to users with VIEW_REPORTS", async () => {
    const tree = await renderDashboardScreen();

    expect(tree.root.findAllByProps({ children: "Today's revenue" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "$42.00" })).toHaveLength(1);

    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: [] },
    });

    const noReportsTree = await renderDashboardScreen();
    expect(noReportsTree.root.findAllByProps({ children: "Today's revenue" })).toHaveLength(0);
  });

  it("routes to the low-stock list and item details from the dashboard cards", async () => {
    const tree = await renderDashboardScreen();
    const buttons = tree.root.findAllByType(MockPressable);

    expect(tree.root.findAllByProps({ children: "Needs restocking" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Rice" })).toHaveLength(1);

    await act(async () => {
      buttons[0].props.onPress();
      buttons[1].props.onPress();
    });

    expect(routerMocks.push).toHaveBeenNthCalledWith(1, "/items?low=1");
    expect(routerMocks.push).toHaveBeenNthCalledWith(2, "/items/i1");
  });

  it("refreshes the reports, items, and activity queries together", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    queryMocks.useQueryClient.mockReturnValue({ invalidateQueries });

    const tree = await renderDashboardScreen();
    const refreshControl = tree.root.findByType(MockRefreshControl);

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["items"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["activity"] });
  });
});
