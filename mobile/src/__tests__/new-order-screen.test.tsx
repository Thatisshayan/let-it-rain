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

const itemsApiMocks = vi.hoisted(() => ({
  fetchItems: vi.fn(),
}));

const ordersApiMocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

const queryClientMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const alertMocks = vi.hoisted(() => ({
  alert: vi.fn(),
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

function MockScrollView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../lib/permissions", () => permissionsMocks);
vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../api/items", () => itemsApiMocks);
vi.mock("../api/orders", () => ordersApiMocks);
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  ScrollView: MockScrollView,
  Alert: alertMocks,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderNewOrderScreen() {
  const NewOrderScreen = (await import("../../app/orders/new")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<NewOrderScreen />);
  });

  return tree!;
}

describe("new order screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["CREATE_ORDERS"] },
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
    queryMocks.useQueryClient.mockReturnValue(queryClientMocks);
    queryMocks.useQuery.mockReturnValue({
      data: [{ id: "item-1", name: "Rain Coat", quantity: 7 }],
      isLoading: false,
      error: null,
    });
  });

  it("shows a local deny state when the user lacks CREATE_ORDERS", async () => {
    permissionsMocks.hasPermission.mockReturnValue(false);

    const tree = await renderNewOrderScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to create orders." })).toHaveLength(1);
  });

  it("alerts when the customer name is blank", async () => {
    const tree = await renderNewOrderScreen();
    const submitButton = tree.root.findAllByType(MockPressable).at(-1)!;

    await act(async () => {
      submitButton.props.onPress();
    });

    expect(alertMocks.alert).toHaveBeenCalledWith("Customer name required");
    expect(ordersApiMocks.createOrder).not.toHaveBeenCalled();
  });

  it("shows validation when no item rows are selected", async () => {
    const tree = await renderNewOrderScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const submitButton = tree.root.findAllByType(MockPressable).at(-1)!;

    await act(async () => {
      inputs[0].props.onChangeText("Alice");
    });

    await act(async () => {
      submitButton.props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "Add at least one item." })).toHaveLength(1);
    expect(ordersApiMocks.createOrder).not.toHaveBeenCalled();
  });

  it("creates an order, invalidates the orders query, and redirects to the new order", async () => {
    ordersApiMocks.createOrder.mockResolvedValue({ orderId: "order-99" });

    const tree = await renderNewOrderScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const buttons = tree.root.findAllByType(MockPressable);
    const selectItemButton = buttons[0];
    const submitButton = buttons.at(-1)!;

    await act(async () => {
      inputs[0].props.onChangeText("Alice");
      inputs[1].props.onChangeText("123 Main");
      inputs[2].props.onChangeText("555-0100");
      inputs[4].props.onChangeText("Leave at the door");
      selectItemButton.props.onPress();
      inputs[3].props.onChangeText("3");
    });

    await act(async () => {
      submitButton.props.onPress();
    });

    expect(ordersApiMocks.createOrder).toHaveBeenCalledWith({
      customerName: "Alice",
      customerAddress: "123 Main",
      customerPhone: "555-0100",
      notes: "Leave at the door",
      lineItems: [{ itemId: "item-1", quantity: 3 }],
    });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orders"] });
    expect(routerMocks.replace).toHaveBeenCalledWith("/orders/order-99");
  });
});
