import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const queryMocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
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
  data,
  renderItem,
}: {
  ListHeaderComponent?: React.ReactNode;
  data: unknown[];
  renderItem?: ((args: { item: unknown; index: number }) => React.ReactNode) | null;
}) {
  return (
    <>
      {ListHeaderComponent}
      {renderItem ? data.map((item, index) => <React.Fragment key={index}>{renderItem({ item, index })}</React.Fragment>) : null}
    </>
  );
}

vi.mock("@tanstack/react-query", () => queryMocks);
vi.mock("../../src/api/AuthContext", () => authContextMocks);
vi.mock("../../src/lib/permissions", () => permissionsMocks);
vi.mock("../../src/theme", () => themeMocks);
vi.mock("../../src/api/reports", () => ({
  fetchReports: vi.fn(),
  formatMoney: (value: number) => `$${value.toFixed(2)}`,
}));
vi.mock("../../src/api/activity", () => ({
  adjacentMonthParam: (year: number, month: number, delta: number) => {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  Pressable: MockPressable,
  FlatList: MockFlatList,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function renderReportsScreen() {
  const ReportsScreen = (await import("../../app/(tabs)/reports")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<ReportsScreen />);
  });

  return tree!;
}

describe("reports screen", () => {
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
      card: "#111",
      muted: "#222",
    });
    queryMocks.useQuery.mockImplementation(({ queryKey, enabled }) => {
      if (enabled === false) {
        return { data: undefined, isLoading: false, isRefetching: false, error: null, refetch: vi.fn() };
      }

      const month = queryKey[1];
      if (month === "2026-06") {
        return {
          data: {
            year: 2026,
            month: 6,
            monthLabel: "June 2026",
            todayRevenue: 120,
            monthRevenue: 500,
            monthCash: 300,
            monthInterac: 200,
            monthCogs: 250,
            monthProfit: 250,
            monthRestockCost: 50,
            inventoryValuation: 900,
            revenueByDay: [],
            salesByItem: [],
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
          todayRevenue: 100,
          monthRevenue: 400,
          monthCash: 250,
          monthInterac: 150,
          monthCogs: 225,
          monthProfit: 175,
          monthRestockCost: 75,
          inventoryValuation: 800,
          revenueByDay: [{ date: "2026-05-10", revenue: 75 }],
          salesByItem: [{ itemId: "i1", itemName: "Rice", unitsSold: 3, revenue: 75, profit: 30 }],
        },
        isLoading: false,
        isRefetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });
  });

  it("shows a local deny state when the user lacks VIEW_REPORTS", async () => {
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: [] },
    });

    const tree = await renderReportsScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to view reports." })).toHaveLength(1);
  });

  it("renders report metrics and line items for the current month", async () => {
    const tree = await renderReportsScreen();

    expect(tree.root.findAllByProps({ children: "May 2026" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Today's revenue" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "$100.00" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Rice" })).toHaveLength(1);
    expect(
      tree.root.findAll(
        (node) => Array.isArray(node.props.children) && node.props.children.includes(" units sold")
      )
    ).not.toHaveLength(0);
    expect(
      tree.root.findAll(
        (node) => Array.isArray(node.props.children) && node.props.children.includes("profit ")
      )
    ).not.toHaveLength(0);
  });

  it("moves between months using the prev and next controls", async () => {
    const tree = await renderReportsScreen();
    const buttons = tree.root.findAllByType(MockPressable);

    await act(async () => {
      buttons[1].props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "June 2026" })).toHaveLength(1);

    await act(async () => {
      buttons[0].props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "May 2026" })).toHaveLength(1);
  });
});
