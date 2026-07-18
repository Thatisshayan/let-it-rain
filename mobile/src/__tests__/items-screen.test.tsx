import React, { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

const exportMocks = vi.hoisted(() => ({
  exportItemsCsv: vi.fn(),
}));

const itemsApiMocks = vi.hoisted(() => ({
  fetchItems: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

const alertMocks = vi.hoisted(() => ({
  alert: vi.fn(),
}));

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

function MockFlatList({
  data,
  renderItem,
  ListHeaderComponent,
  refreshControl,
}: {
  data: unknown[];
  renderItem?: ((args: { item: unknown; index: number }) => React.ReactNode) | null;
  ListHeaderComponent?: React.ReactNode;
  refreshControl?: React.ReactNode;
}) {
  return (
    <>
      {refreshControl}
      {ListHeaderComponent}
      {renderItem ? data.map((item, index) => <React.Fragment key={index}>{renderItem({ item, index })}</React.Fragment>) : null}
    </>
  );
}

function MockRefreshControl() {
  return null;
}

const MockSwipeable = forwardRef(function MockSwipeable(
  {
    children,
    renderRightActions,
  }: {
    children: React.ReactNode;
    renderRightActions: () => React.ReactNode;
  },
  ref: React.ForwardedRef<{ close: () => void }>
) {
  useImperativeHandle(ref, () => ({
    close: vi.fn(),
  }));

  return (
    <>
      {children}
      {renderRightActions()}
    </>
  );
});

function MockSkeleton() {
  return null;
}

vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../../src/api/export", () => exportMocks);
vi.mock("../../src/api/items", () => itemsApiMocks);
vi.mock("../../src/theme", () => themeMocks);
vi.mock("../../src/Skeleton", () => ({
  Skeleton: MockSkeleton,
}));
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
vi.mock("react-native-gesture-handler/ReanimatedSwipeable", () => ({
  default: MockSwipeable,
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  FlatList: MockFlatList,
  RefreshControl: MockRefreshControl,
  Alert: alertMocks,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

const allItems = [
  { id: "i1", name: "Rice", quantity: 2, minStock: 5, lowStock: true, category: "Food", unitCost: 3 },
  { id: "i2", name: "Beans", quantity: 8, minStock: 4, lowStock: false, category: "Food", unitCost: 2 },
  { id: "i3", name: "Apron", quantity: 3, minStock: 1, lowStock: false, category: "Supplies", unitCost: 10 },
];

async function renderItemsScreen() {
  const ItemsScreen = (await import("../../app/(tabs)/items")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<ItemsScreen />);
  });

  return tree!;
}

describe("items screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      mutedForeground: "#777",
      destructive: "#f33",
      primary: "#09f",
      primaryForeground: "#111",
      muted: "#222",
    });
    queryMocks.useQuery.mockImplementation(({ queryKey }) => {
      const q = String(queryKey[1] ?? "").toLowerCase();
      const lowOnly = Boolean(queryKey[2]);
      const data = allItems.filter((item) => {
        const matchesSearch = q.length === 0 || item.name.toLowerCase().includes(q);
        const matchesLowStock = !lowOnly || item.lowStock;
        return matchesSearch && matchesLowStock;
      });

      return {
        data,
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });
  });

  it("filters by search and low-stock state through the query key", async () => {
    const tree = await renderItemsScreen();
    const searchInput = tree.root.findByType(MockTextInput);
    const buttons = tree.root.findAllByType(MockPressable);
    const lowStockToggle = buttons[1];

    await act(async () => {
      searchInput.props.onChangeText("ri");
    });

    expect(queryMocks.useQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: ["items", "ri", false],
      })
    );

    await act(async () => {
      lowStockToggle.props.onPress();
    });

    expect(queryMocks.useQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: ["items", "ri", true],
      })
    );
    expect(tree.root.findAllByProps({ children: "Showing low stock only" })).toHaveLength(1);
  });

  it("sorts visible items and filters them by category", async () => {
    const tree = await renderItemsScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const sortByQuantityButton = buttons[6];
    const foodChip = buttons[3];

    await act(async () => {
      foodChip.props.onPress();
    });

    await act(async () => {
      sortByQuantityButton.props.onPress();
    });

    const names = tree.root.findAllByProps({ children: "Beans" }).concat(tree.root.findAllByProps({ children: "Rice" }));

    expect(tree.root.findAllByProps({ children: "Apron" })).toHaveLength(0);
    expect(names).toHaveLength(2);
  });

  it("alerts when CSV export fails", async () => {
    exportMocks.exportItemsCsv.mockRejectedValue(new Error("share failed"));

    const tree = await renderItemsScreen();
    const exportButton = tree.root.findAllByType(MockPressable)[0];

    await act(async () => {
      await exportButton.props.onPress();
    });

    expect(alertMocks.alert).toHaveBeenCalledWith("Export failed", "share failed");
  });

  it("routes to item detail, adjust stock, and new item flows", async () => {
    const tree = await renderItemsScreen();
    const detailButton = tree.root.find(
      (node) => node.type === MockPressable && node.props.accessibilityLabel === "Rice, 2 in stock, low stock. Tap for details."
    );
    const adjustButton = tree.root.find(
      (node) => node.type === MockPressable && node.props.accessibilityLabel === "Adjust stock for Rice"
    );
    const newItemButton = tree.root.find(
      (node) => node.type === MockPressable && node.props.accessibilityLabel === "Add new item"
    );

    await act(async () => {
      detailButton.props.onPress();
      adjustButton.props.onPress();
      newItemButton.props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/items/i1");
    expect(routerMocks.push).toHaveBeenCalledWith("/items/i1/adjust");
    expect(routerMocks.push).toHaveBeenCalledWith("/items/new");
  });
});
