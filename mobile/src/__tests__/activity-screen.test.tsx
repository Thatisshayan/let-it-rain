import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
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

function MockScrollView({ children, refreshControl }: { children: React.ReactNode; refreshControl?: React.ReactNode }) {
  return (
    <>
      {refreshControl}
      {children}
    </>
  );
}

function MockFlatList({
  data,
  renderItem,
}: {
  data: unknown[];
  renderItem?: ((args: { item: unknown; index: number }) => React.ReactNode) | null;
}) {
  return <>{renderItem ? data.map((item, index) => <React.Fragment key={index}>{renderItem({ item, index })}</React.Fragment>) : null}</>;
}

function MockRefreshControl() {
  return null;
}

vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../../src/theme", () => themeMocks);
vi.mock("../../src/api/activity", () => {
  function adjacentMonthParam(year: number, month: number, delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return {
    fetchActivity: vi.fn(),
    adjacentMonthParam,
  };
});
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  Pressable: MockPressable,
  FlatList: MockFlatList,
  ScrollView: MockScrollView,
  RefreshControl: MockRefreshControl,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderActivityScreen() {
  const ActivityScreen = (await import("../../app/(tabs)/activity")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<ActivityScreen />);
  });

  return tree!;
}

describe("activity screen", () => {
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
      success: "#0f0",
      rain: "#55f",
    });
    queryMocks.useQuery.mockImplementation(({ queryKey }) => {
      const month = queryKey[1];
      if (month === "2026-06") {
        return {
          data: {
            year: 2026,
            month: 6,
            monthLabel: "June 2026",
            weeks: [[{ date: "2026-06-01", inMonth: true }]],
            days: {},
            movements: [],
          },
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: vi.fn(),
        };
      }

      return {
        data: {
          year: 2026,
          month: 5,
          monthLabel: "May 2026",
          weeks: [[{ date: "2026-05-10", inMonth: true }]],
          days: {
            "2026-05-10": { net: -2, count: 1 },
          },
          movements: [
            {
              id: "m1",
              itemName: "Rice",
              type: "REMOVE",
              delta: -2,
              userName: "Alice",
              reason: "Delivery",
              createdAt: "2026-05-10T12:00:00.000Z",
            },
          ],
        },
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });
  });

  it("shows the selected day's movement details", async () => {
    const tree = await renderActivityScreen();
    const buttons = tree.root.findAllByType(MockPressable);

    await act(async () => {
      buttons[2].props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "2026-05-10" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Delivery" })).toHaveLength(1);
    expect(
      tree.root.findAll(
        (node) => Array.isArray(node.props.children) && node.props.children.includes("Alice")
      )
    ).not.toHaveLength(0);
  });

  it("moves to another month and clears the old day selection", async () => {
    const tree = await renderActivityScreen();
    const buttons = tree.root.findAllByType(MockPressable);

    await act(async () => {
      buttons[2].props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "2026-05-10" })).toHaveLength(1);

    await act(async () => {
      buttons[1].props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "June 2026" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "2026-05-10" })).toHaveLength(0);
  });
});
