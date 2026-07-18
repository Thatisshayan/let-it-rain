import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

const itemsApiMocks = vi.hoisted(() => ({
  fetchItem: vi.fn(),
}));

const exportMocks = vi.hoisted(() => ({
  exportItemMovementsCsv: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const routeMocks = vi.hoisted(() => ({
  useLocalSearchParams: vi.fn(),
  push: vi.fn(),
}));

const alertMocks = vi.hoisted(() => ({
  alert: vi.fn(),
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
  data: Array<{ id: string }>;
  renderItem: (info: { item: any }) => React.ReactNode;
}) {
  return (
    <>
      {data.map((item) => (
        <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
      ))}
    </>
  );
}

function MockRefreshControl() {
  return null;
}

vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../api/items", () => itemsApiMocks);
vi.mock("../api/export", () => exportMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("expo-router", () => ({
  useLocalSearchParams: routeMocks.useLocalSearchParams,
  router: { push: routeMocks.push },
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  FlatList: MockFlatList,
  Pressable: MockPressable,
  RefreshControl: MockRefreshControl,
  Alert: alertMocks,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

const itemData = {
  item: { id: "item-1", name: "Rain Coat", quantity: 7, minStock: 2 },
  movements: [
    {
      id: "m1",
      type: "ADD",
      delta: 3,
      quantityAfter: 7,
      createdAt: "2026-07-17T12:00:00.000Z",
      user: { name: "Alice" },
      isSale: false,
      cashAmount: null,
      interacAmount: null,
    },
  ],
};

async function renderItemDetailScreen() {
  const ItemDetailScreen = (await import("../../app/items/[id]/index")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<ItemDetailScreen />);
  });

  return tree!;
}

describe("item detail screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
    queryMocks.useQuery.mockReturnValue({
      data: itemData,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("shows the load error state when the item cannot be fetched", async () => {
    queryMocks.useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isRefetching: false,
      error: new Error("nope"),
      refetch: vi.fn(),
    });

    const tree = await renderItemDetailScreen();

    expect(tree.root.findAllByProps({ children: "Could not load item." })).toHaveLength(1);
  });

  it("navigates to adjust and edit actions", async () => {
    const tree = await renderItemDetailScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const adjustButton = buttons[0];
    const editButton = buttons[1];

    await act(async () => {
      adjustButton.props.onPress();
      editButton.props.onPress();
    });

    expect(routeMocks.push).toHaveBeenCalledWith("/items/item-1/adjust");
    expect(routeMocks.push).toHaveBeenCalledWith("/items/item-1/edit");
  });

  it("exports movement history successfully", async () => {
    exportMocks.exportItemMovementsCsv.mockResolvedValue(undefined);

    const tree = await renderItemDetailScreen();
    const exportButton = tree.root.findAllByType(MockPressable)[2];

    await act(async () => {
      await exportButton.props.onPress();
    });

    expect(exportMocks.exportItemMovementsCsv).toHaveBeenCalledWith("item-1", "Rain Coat");
    expect(alertMocks.alert).not.toHaveBeenCalled();
  });

  it("shows an alert when export fails", async () => {
    exportMocks.exportItemMovementsCsv.mockRejectedValue(new Error("share failed"));

    const tree = await renderItemDetailScreen();
    const exportButton = tree.root.findAllByType(MockPressable)[2];

    await act(async () => {
      await exportButton.props.onPress();
    });

    expect(alertMocks.alert).toHaveBeenCalledWith("Export failed", "share failed");
  });
});
