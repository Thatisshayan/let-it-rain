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
  useQueryClient: vi.fn(),
}));

const orderApiMocks = vi.hoisted(() => ({
  fetchOrder: vi.fn(),
  fetchDrivers: vi.fn(),
  assignDriver: vi.fn(),
  markOutForDelivery: vi.fn(),
  markDelivered: vi.fn(),
  cancelOrder: vi.fn(),
}));

const offlineQueueMocks = vi.hoisted(() => ({
  enqueueOrderAction: vi.fn(),
}));

const routeMocks = vi.hoisted(() => ({
  useLocalSearchParams: vi.fn(),
}));

const hapticsMocks = vi.hoisted(() => ({
  notificationAsync: vi.fn(),
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
  },
}));

const toastMocks = vi.hoisted(() => ({
  show: vi.fn(),
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

function MockTextInput(_: Record<string, unknown>) {
  return null;
}

function MockPressable({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockScrollView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../lib/permissions", () => permissionsMocks);
vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../api/orders", () => orderApiMocks);
vi.mock("../offlineQueue", () => offlineQueueMocks);
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
vi.mock("expo-router", () => routeMocks);
vi.mock("expo-haptics", () => hapticsMocks);
vi.mock("../toast", () => ({
  useToast: () => toastMocks,
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  ScrollView: MockScrollView,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

const baseOrder = {
  id: "order-1",
  customerName: "Alice",
  customerAddress: "123 Main",
  customerPhone: "555-0100",
  status: "PENDING" as const,
  driver: { id: "driver-1", name: "Drew" },
  lineItems: [{ id: "li-1", itemName: "Rain Coat", quantity: 2 }],
};

async function renderOrderDetailScreen() {
  const OrderDetailScreen = (await import("../../app/orders/[id]")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<OrderDetailScreen />);
  });

  return tree!;
}

describe("order detail screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "driver-1", permissions: ["ASSIGN_DRIVERS", "CANCEL_ORDERS"] },
    });
    permissionsMocks.canManageOrders.mockReturnValue(true);
    permissionsMocks.hasPermission.mockImplementation((_user: unknown, permission: string) => {
      return permission === "ASSIGN_DRIVERS" || permission === "CANCEL_ORDERS";
    });
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
    routeMocks.useLocalSearchParams.mockReturnValue({ id: "order-1" });
    queryClientMocks.invalidateQueries.mockResolvedValue(undefined);
    queryMocks.useQueryClient.mockReturnValue(queryClientMocks);
    queryMocks.useQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === "order") {
        return { data: baseOrder, isLoading: false, error: null };
      }
      if (queryKey[0] === "orderDrivers") {
        return { data: [{ id: "driver-2", name: "Blair" }], isLoading: false, error: null };
      }
      return { data: undefined, isLoading: false, error: null };
    });
  });

  it("shows the load error state when the order cannot be fetched", async () => {
    queryMocks.useQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === "order") {
        return { data: undefined, isLoading: false, error: new Error("nope") };
      }
      return { data: undefined, isLoading: false, error: null };
    });

    const tree = await renderOrderDetailScreen();

    expect(tree.root.findAllByProps({ children: "Could not load this order." })).toHaveLength(1);
  });

  it("assigns a driver and invalidates the order-related queries", async () => {
    orderApiMocks.assignDriver.mockResolvedValue({ ok: true });

    const tree = await renderOrderDetailScreen();
    const assignDriverChip = tree.root.findAllByType(MockPressable)[0];

    await act(async () => {
      await assignDriverChip.props.onPress();
    });

    expect(orderApiMocks.assignDriver).toHaveBeenCalledWith("order-1", "driver-2");
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["order", "order-1"] });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orders"] });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["items"] });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports"] });
  });

  it("queues out-for-delivery when offline instead of surfacing a hard failure", async () => {
    orderApiMocks.markOutForDelivery.mockRejectedValue(new MockApiError(0, "offline"));

    const tree = await renderOrderDetailScreen();
    const outForDeliveryButton = tree.root.findAllByType(MockPressable)[1];

    await act(async () => {
      await outForDeliveryButton.props.onPress();
    });

    expect(offlineQueueMocks.enqueueOrderAction).toHaveBeenCalledWith({
      orderId: "order-1",
      type: "out_for_delivery",
    });
    expect(toastMocks.show).toHaveBeenCalledWith("You're offline — this will sync automatically once you're back online.");
  });

  it("queues delivered payments when offline", async () => {
    orderApiMocks.markDelivered.mockRejectedValue(new MockApiError(0, "offline"));

    const tree = await renderOrderDetailScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const confirmDeliveredButton = tree.root.findAllByType(MockPressable)[2];

    await act(async () => {
      inputs[0].props.onChangeText("10");
      inputs[1].props.onChangeText("5");
    });

    await act(async () => {
      await confirmDeliveredButton.props.onPress();
    });

    expect(offlineQueueMocks.enqueueOrderAction).toHaveBeenCalledWith({
      orderId: "order-1",
      type: "deliver",
      payments: [{ lineItemId: "li-1", cashAmount: 10, interacAmount: 5 }],
    });
    expect(toastMocks.show).toHaveBeenCalledWith("You're offline — this will sync automatically once you're back online.");
  });
});
