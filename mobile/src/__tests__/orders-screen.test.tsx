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
  canManageOrders: vi.fn(),
  hasPermission: vi.fn(),
}));

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

const ordersApiMocks = vi.hoisted(() => ({
  fetchOrders: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

const insetsMocks = vi.hoisted(() => ({
  top: 12,
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

function MockRefreshControl() {
  return null;
}

function MockFlatList({
  data,
  renderItem,
  ListEmptyComponent,
}: {
  data: Array<{ id: string }>;
  renderItem: (info: { item: any }) => React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
}) {
  if (!data.length) return <>{ListEmptyComponent ?? null}</>;
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
vi.mock("../api/orders", () => ordersApiMocks);
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => insetsMocks,
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  FlatList: MockFlatList,
  Pressable: MockPressable,
  RefreshControl: MockRefreshControl,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderOrdersScreen() {
  const OrdersScreen = (await import("../../app/(tabs)/orders")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<OrdersScreen />);
  });

  return tree!;
}

describe("orders screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["CREATE_ORDERS"] },
    });
    permissionsMocks.canManageOrders.mockReturnValue(true);
    permissionsMocks.hasPermission.mockImplementation((_user: unknown, permission: string) => permission === "CREATE_ORDERS");
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      mutedForeground: "#777",
      destructive: "#f33",
      success: "#0f0",
      warning: "#ff0",
      primary: "#09f",
      primaryForeground: "#111",
    });
    queryMocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("shows the load error state and retries", async () => {
    const refetch = vi.fn();
    queryMocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isRefetching: false,
      error: new Error("nope"),
      refetch,
    });

    const tree = await renderOrdersScreen();
    const retryButton = tree.root.findAllByType(MockPressable)[1];

    expect(tree.root.findAllByProps({ children: "Could not load orders." })).toHaveLength(1);

    await act(async () => {
      retryButton.props.onPress();
    });

    expect(refetch).toHaveBeenCalled();
  });

  it("shows the managed empty state and a new-order button for creators", async () => {
    const tree = await renderOrdersScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const newButton = buttons[0];

    expect(tree.root.findAllByProps({ children: "All orders" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "No orders yet." })).toHaveLength(1);

    await act(async () => {
      newButton.props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/orders/new");
  });

  it("shows the driver-scoped empty state when the user cannot manage orders", async () => {
    permissionsMocks.canManageOrders.mockReturnValue(false);
    permissionsMocks.hasPermission.mockReturnValue(false);

    const tree = await renderOrdersScreen();

    expect(tree.root.findAllByProps({ children: "Assigned to you" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "No orders assigned to you yet." })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "+ New" })).toHaveLength(0);
  });

  it("navigates to an order detail row", async () => {
    queryMocks.useQuery.mockReturnValue({
      data: [
        {
          id: "order-1",
          customerName: "Alice",
          lineItems: [{ id: "li-1" }, { id: "li-2" }],
          driver: { name: "Drew" },
          status: "PENDING",
        },
      ],
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });

    const tree = await renderOrdersScreen();
    const orderRow = tree.root.findAllByType(MockPressable)[1];

    await act(async () => {
      orderRow.props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/orders/order-1");
  });
});
