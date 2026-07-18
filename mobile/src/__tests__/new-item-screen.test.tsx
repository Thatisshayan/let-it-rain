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
  createItem: vi.fn(),
}));

const routeMocks = vi.hoisted(() => ({
  replace: vi.fn(),
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
  router: { replace: routeMocks.replace },
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

async function renderNewItemScreen() {
  const NewItemScreen = (await import("../../app/items/new")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<NewItemScreen />);
  });

  return tree!;
}

describe("new item screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["EDIT_ITEMS", "VIEW_COSTS"] },
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
    });
    queryClientMocks.invalidateQueries.mockResolvedValue(undefined);
    queryMocks.useQueryClient.mockReturnValue(queryClientMocks);
  });

  it("shows a local deny state when the user lacks EDIT_ITEMS", async () => {
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: [] },
    });

    const tree = await renderNewItemScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to create items." })).toHaveLength(1);
  });

  it("creates an item with cost fields, invalidates the list, and redirects to the detail screen", async () => {
    itemsApiMocks.createItem.mockResolvedValue({ itemId: "item-1" });

    const tree = await renderNewItemScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const submitButton = tree.root.findByType(MockPressable);

    await act(async () => {
      inputs[0].props.onChangeText("Rice");
      inputs[1].props.onChangeText("3");
      inputs[2].props.onChangeText("10");
      inputs[3].props.onChangeText(" Shelf A-3 ");
      inputs[4].props.onChangeText("2.5");
      inputs[5].props.onChangeText("4.75");
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(itemsApiMocks.createItem).toHaveBeenCalledWith({
      name: "Rice",
      minStock: 3,
      initialQuantity: 10,
      location: "Shelf A-3",
      unitCost: 2.5,
      unitPrice: 4.75,
    });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["items"] });
    expect(hapticsMocks.notificationAsync).toHaveBeenCalledWith(hapticsMocks.NotificationFeedbackType.Success);
    expect(toastMocks.show).toHaveBeenCalledWith("Item created");
    expect(routeMocks.replace).toHaveBeenCalledWith("/items/item-1");
  });

  it("omits cost editing for users without VIEW_COSTS and sends zeroed cost fields", async () => {
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["EDIT_ITEMS"] },
    });
    itemsApiMocks.createItem.mockResolvedValue({ itemId: "item-2" });

    const tree = await renderNewItemScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const submitButton = tree.root.findByType(MockPressable);

    expect(inputs).toHaveLength(4);

    await act(async () => {
      inputs[0].props.onChangeText("Beans");
      inputs[1].props.onChangeText("2");
      inputs[2].props.onChangeText("8");
      inputs[3].props.onChangeText("Shelf B");
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(itemsApiMocks.createItem).toHaveBeenCalledWith({
      name: "Beans",
      minStock: 2,
      initialQuantity: 8,
      location: "Shelf B",
      unitCost: 0,
      unitPrice: 0,
    });
  });

  it("shows the API error message when creation fails", async () => {
    itemsApiMocks.createItem.mockRejectedValue(new MockApiError(400, "Item name is required"));

    const tree = await renderNewItemScreen();
    const submitButton = tree.root.findByType(MockPressable);

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(hapticsMocks.notificationAsync).toHaveBeenCalledWith(hapticsMocks.NotificationFeedbackType.Error);
    expect(tree.root.findAllByProps({ children: "Item name is required" })).toHaveLength(1);
  });
});
