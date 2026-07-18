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
  fetchItem: vi.fn(),
  updateItem: vi.fn(),
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

async function renderEditItemScreen() {
  const EditItemScreen = (await import("../../app/items/[id]/edit")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<EditItemScreen />);
  });

  return tree!;
}

describe("edit item screen", () => {
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
    routeMocks.useLocalSearchParams.mockReturnValue({ id: "item-1" });
    queryClientMocks.invalidateQueries.mockResolvedValue(undefined);
    queryMocks.useQueryClient.mockReturnValue(queryClientMocks);
    queryMocks.useQuery.mockReturnValue({
      data: {
        item: {
          name: "Rice",
          minStock: 3,
          unitCost: 2.5,
          unitPrice: 4.75,
        },
      },
      isLoading: false,
      error: null,
    });
  });

  it("shows a local deny state when the user lacks EDIT_ITEMS", async () => {
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: [] },
    });

    const tree = await renderEditItemScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to edit items." })).toHaveLength(1);
  });

  it("shows the load error state when the item cannot be fetched", async () => {
    queryMocks.useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("nope"),
    });

    const tree = await renderEditItemScreen();

    expect(tree.root.findAllByProps({ children: "Could not load this item." })).toHaveLength(1);
  });

  it("updates the item, invalidates caches, and returns to the previous screen", async () => {
    itemsApiMocks.updateItem.mockResolvedValue(undefined);

    const tree = await renderEditItemScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const submitButton = tree.root.findByType(MockPressable);

    await act(async () => {
      inputs[0].props.onChangeText("Rice Premium");
      inputs[1].props.onChangeText("5");
      inputs[2].props.onChangeText("3");
      inputs[3].props.onChangeText("6");
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(itemsApiMocks.updateItem).toHaveBeenCalledWith("item-1", {
      name: "Rice Premium",
      minStock: 5,
      unitCost: 3,
      unitPrice: 6,
    });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["item", "item-1"] });
    expect(queryClientMocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["items"] });
    expect(hapticsMocks.notificationAsync).toHaveBeenCalledWith(hapticsMocks.NotificationFeedbackType.Success);
    expect(toastMocks.show).toHaveBeenCalledWith("Item updated");
    expect(routeMocks.back).toHaveBeenCalled();
  });

  it("hides cost inputs without VIEW_COSTS and falls back to zeroed cost values", async () => {
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["EDIT_ITEMS"] },
    });
    itemsApiMocks.updateItem.mockResolvedValue(undefined);

    const tree = await renderEditItemScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const submitButton = tree.root.findByType(MockPressable);

    expect(inputs).toHaveLength(2);

    await act(async () => {
      inputs[0].props.onChangeText("Rice Basic");
      inputs[1].props.onChangeText("4");
    });

    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(itemsApiMocks.updateItem).toHaveBeenCalledWith("item-1", {
      name: "Rice Basic",
      minStock: 4,
      unitCost: 0,
      unitPrice: 0,
    });
  });
});
