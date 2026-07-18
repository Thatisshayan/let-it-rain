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
  useQueryClient: vi.fn(),
}));

const itemsApiMocks = vi.hoisted(() => ({
  adjustStock: vi.fn(),
}));

const routeMocks = vi.hoisted(() => ({
  useLocalSearchParams: vi.fn(),
  back: vi.fn(),
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
vi.mock("../api/items", () => itemsApiMocks);
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: routeMocks.useLocalSearchParams,
  router: { back: routeMocks.back },
}));
vi.mock("expo-haptics", () => hapticsMocks);
vi.mock("../toast", () => ({
  useToast: () => toastMocks,
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

async function renderAdjustStockScreen() {
  const AdjustStockScreen = (await import("../../app/items/[id]/adjust")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<AdjustStockScreen />);
  });

  return tree!;
}

describe("adjust stock screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["ADJUST_STOCK"] },
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
    routeMocks.useLocalSearchParams.mockReturnValue({ id: "item-1" });
    queryClientMocks.invalidateQueries.mockResolvedValue(undefined);
    queryMocks.useQueryClient.mockReturnValue(queryClientMocks);
  });

  it("shows a local deny state when the user lacks ADJUST_STOCK", async () => {
    permissionsMocks.hasPermission.mockReturnValue(false);

    const tree = await renderAdjustStockScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to adjust stock." })).toHaveLength(1);
  });

  it("shows validation when the amount is not numeric", async () => {
    const tree = await renderAdjustStockScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const submitButton = tree.root.findAllByType(MockPressable).at(-1)!;

    await act(async () => {
      inputs[0].props.onChangeText("nope");
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "Enter a valid number." })).toHaveLength(1);
    expect(itemsApiMocks.adjustStock).not.toHaveBeenCalled();
  });

  it("submits REMOVE adjustments with sale amounts and completes the success flow", async () => {
    itemsApiMocks.adjustStock.mockResolvedValue(undefined);

    const tree = await renderAdjustStockScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const removeTypeButton = buttons[1];
    const submitButton = buttons.at(-1)!;

    await act(async () => {
      removeTypeButton.props.onPress();
    });

    const inputs = tree.root.findAllByType(MockTextInput);

    await act(async () => {
      inputs[0].props.onChangeText("3");
      inputs[1].props.onChangeText("10.5");
      inputs[2].props.onChangeText("4.5");
      inputs[3].props.onChangeText("Sold to customer");
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(itemsApiMocks.adjustStock).toHaveBeenCalledWith("item-1", {
      type: "REMOVE",
      amount: 3,
      cashAmount: 10.5,
      interacAmount: 4.5,
      reason: "Sold to customer",
    });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["item", "item-1"] });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["items"] });
    expect(hapticsMocks.notificationAsync).toHaveBeenCalledWith(hapticsMocks.NotificationFeedbackType.Success);
    expect(toastMocks.show).toHaveBeenCalledWith("Stock adjusted");
    expect(routeMocks.back).toHaveBeenCalled();
  });

  it("submits ADJUST with counted quantity", async () => {
    itemsApiMocks.adjustStock.mockResolvedValue(undefined);

    const tree = await renderAdjustStockScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const adjustTypeButton = buttons[2];
    const submitButton = buttons.at(-1)!;

    await act(async () => {
      adjustTypeButton.props.onPress();
    });

    const inputs = tree.root.findAllByType(MockTextInput);

    await act(async () => {
      inputs[0].props.onChangeText("12");
      inputs[1].props.onChangeText("Inventory count");
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(itemsApiMocks.adjustStock).toHaveBeenCalledWith("item-1", {
      type: "ADJUST",
      counted: 12,
      reason: "Inventory count",
    });
  });
});
