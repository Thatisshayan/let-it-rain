# Mobile App Phase 4 (Accounting & Reports) Implementation Plan

> **For agentic workers:** Execute inline, task by task, in the current session. No subagent dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/v1/reports` and a mobile Reports screen showing revenue/COGS/profit/valuation summaries and breakdowns, reusing the existing `reports.ts` and `calendar.ts` pure functions unchanged.

**Architecture:** One new read-only Route Handler wrapping the existing Prisma queries + `reports.ts`/`calendar.ts` helpers (no service-layer extraction needed — no mutations). Mobile adds a Reports screen fetching one month at a time via React Query, with a manual money formatter and a short cache `staleTime`.

**Tech Stack:** Same as Phases 1–3 — Next.js Route Handlers, existing `reports.ts`/`calendar.ts` helpers, Expo Router + React Query.

---

## Task 1: `GET /api/v1/reports`

**Files:**
- Create: `src/app/api/v1/reports/route.ts`
- Test: `src/app/api/v1/reports/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/reports/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { movement: { findMany: vi.fn() }, item: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function token() {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions: [] })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("GET /api/v1/reports", () => {
  it("returns 401 without a token", async () => {
    const res = await GET(new Request("http://localhost/api/v1/reports"));
    expect(res.status).toBe(401);
  });

  it("returns aggregated figures for the requested month", async () => {
    (prisma.movement.findMany as any)
      .mockResolvedValueOnce([
        {
          id: "m1",
          item: { id: "i1", name: "Widget" },
          delta: -2,
          isSale: true,
          type: "REMOVE",
          unitPriceAtTime: 10,
          unitCostAtTime: 4,
          createdAt: new Date("2026-07-11T12:00:00.000Z"),
        },
        {
          id: "m2",
          item: { id: "i1", name: "Widget" },
          delta: 20,
          isSale: false,
          type: "RECEIVE",
          unitPriceAtTime: null,
          unitCostAtTime: 4,
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          delta: -2,
          unitPriceAtTime: 10,
          createdAt: new Date("2026-07-11T12:00:00.000Z"),
        },
      ]);
    (prisma.item.findMany as any).mockResolvedValue([
      { quantity: 10, unitCost: 4 },
    ]);

    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/reports?month=2026-07", {
        headers: { authorization: `Bearer ${t}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2026);
    expect(body.month).toBe(7);
    expect(body.monthRevenue).toBe(20);
    expect(body.monthCogs).toBe(8);
    expect(body.monthProfit).toBe(12);
    expect(body.monthRestockCost).toBe(80);
    expect(body.inventoryValuation).toBe(40);
    expect(body.revenueByDay).toEqual([{ date: "2026-07-11", revenue: 20 }]);
    expect(body.salesByItem).toEqual([
      { itemId: "i1", itemName: "Widget", unitsSold: 2, revenue: 20, cogs: 8, profit: 12 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/reports/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/reports/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/auth";
import { parseMonthParam, monthLabel, monthRange } from "@/app/(app)/activity/calendar";
import { totalRevenue, totalCogs, totalRestockCost, revenueByDay, salesByItem } from "@/app/(app)/reports/reports";

export async function GET(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const [monthMovements, todaySaleMovements, items] = await Promise.all([
    prisma.movement.findMany({
      where: { createdAt: { gte: start, lt: end }, OR: [{ isSale: true }, { type: "RECEIVE" }] },
      include: { item: { select: { id: true, name: true } } },
    }),
    prisma.movement.findMany({
      where: { isSale: true, createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.item.findMany({
      where: { deletedAt: null },
      select: { quantity: true, unitCost: true },
    }),
  ]);

  const monthSales = monthMovements
    .filter((m) => m.isSale)
    .map((m) => ({
      itemId: m.item.id,
      itemName: m.item.name,
      delta: m.delta,
      unitPriceAtTime: m.unitPriceAtTime ? Number(m.unitPriceAtTime) : null,
      unitCostAtTime: m.unitCostAtTime ? Number(m.unitCostAtTime) : null,
      createdAt: m.createdAt,
    }));

  const monthRestocks = monthMovements
    .filter((m) => m.type === "RECEIVE")
    .map((m) => ({
      delta: m.delta,
      unitCostAtTime: m.unitCostAtTime ? Number(m.unitCostAtTime) : null,
      createdAt: m.createdAt,
    }));

  const todayRevenue = totalRevenue(
    todaySaleMovements.map((m) => ({
      itemId: "",
      itemName: "",
      delta: m.delta,
      unitPriceAtTime: m.unitPriceAtTime ? Number(m.unitPriceAtTime) : null,
      unitCostAtTime: null,
      createdAt: m.createdAt,
    }))
  );

  const monthRevenue = totalRevenue(monthSales);
  const monthCogs = totalCogs(monthSales);
  const monthProfit = monthRevenue - monthCogs;
  const monthRestockCost = totalRestockCost(monthRestocks);
  const inventoryValuation = items.reduce((sum, i) => sum + i.quantity * Number(i.unitCost), 0);
  const byDay = revenueByDay(monthSales);
  const byItem = salesByItem(monthSales);

  const revenueByDayList = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, revenue]) => ({ date, revenue }));

  return NextResponse.json({
    year,
    month,
    monthLabel: monthLabel(year, month),
    todayRevenue,
    monthRevenue,
    monthCogs,
    monthProfit,
    monthRestockCost,
    inventoryValuation,
    revenueByDay: revenueByDayList,
    salesByItem: byItem,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/reports/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites (existing + new).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v1/reports
git commit -m "Add GET /api/v1/reports"
```

---

## Task 2: Mobile Reports screen

**Files:**
- Create: `mobile/src/api/reports.ts`
- Create: `mobile/app/reports.tsx`
- Modify: `mobile/app/items/index.tsx` (add a Reports link next to Activity/Settings)

- [ ] **Step 1: Typed reports API calls + money formatter**

```ts
// mobile/src/api/reports.ts
import { apiFetch } from "./client";

export type RevenueByDayEntry = { date: string; revenue: number };

export type ItemSalesSummary = {
  itemId: string;
  itemName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
};

export type ReportsMonth = {
  year: number;
  month: number;
  monthLabel: string;
  todayRevenue: number;
  monthRevenue: number;
  monthCogs: number;
  monthProfit: number;
  monthRestockCost: number;
  inventoryValuation: number;
  revenueByDay: RevenueByDayEntry[];
  salesByItem: ItemSalesSummary[];
};

export async function fetchReports(month?: string): Promise<ReportsMonth> {
  const qs = month ? `?month=${month}` : "";
  return apiFetch(`/api/v1/reports${qs}`);
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toFixed(2);
  const [whole, cents] = abs.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${cents}`;
}
```

- [ ] **Step 2: Reports screen**

```tsx
// mobile/app/reports.tsx
import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchReports, formatMoney } from "../src/api/reports";
import { adjacentMonthParam } from "../src/api/activity";

export default function ReportsScreen() {
  const [month, setMonth] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", month],
    queryFn: () => fetchReports(month),
    staleTime: 30_000,
  });

  function goToMonth(delta: number) {
    if (!data) return;
    setMonth(adjacentMonthParam(data.year, data.month, delta));
  }

  if (isLoading || !data) return <Text style={styles.padded}>Loading...</Text>;
  if (error) return <Text style={[styles.padded, styles.error]}>Could not load reports.</Text>;

  const cards: { label: string; value: string; negative?: boolean }[] = [
    { label: "Today's revenue", value: formatMoney(data.todayRevenue) },
    { label: `${data.monthLabel} revenue`, value: formatMoney(data.monthRevenue) },
    { label: "Cost of goods sold", value: formatMoney(data.monthCogs) },
    { label: "Gross profit", value: formatMoney(data.monthProfit), negative: data.monthProfit < 0 },
    { label: "Restock cost", value: formatMoney(data.monthRestockCost) },
    { label: "Inventory valuation", value: formatMoney(data.inventoryValuation) },
  ];

  return (
    <FlatList
      style={styles.container}
      data={[]}
      keyExtractor={() => "x"}
      renderItem={null}
      ListHeaderComponent={
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={() => goToMonth(-1)}>
              <Text>← Prev</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{data.monthLabel}</Text>
            <Pressable onPress={() => goToMonth(1)}>
              <Text>Next →</Text>
            </Pressable>
          </View>

          <View style={styles.cardsGrid}>
            {cards.map((c) => (
              <View key={c.label} style={styles.card}>
                <Text style={styles.cardLabel}>{c.label}</Text>
                <Text style={[styles.cardValue, c.negative && styles.negative]}>{c.value}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Revenue by day</Text>
          {data.revenueByDay.length === 0 ? (
            <Text style={styles.empty}>No sales recorded this month.</Text>
          ) : (
            data.revenueByDay.map((d) => (
              <View key={d.date} style={styles.row}>
                <Text>{d.date}</Text>
                <Text style={styles.rowValue}>{formatMoney(d.revenue)}</Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Sales by item</Text>
          {data.salesByItem.length === 0 ? (
            <Text style={styles.empty}>No sales recorded this month.</Text>
          ) : (
            data.salesByItem.map((row) => (
              <View key={row.itemId} style={styles.row}>
                <View>
                  <Text style={styles.rowName}>{row.itemName}</Text>
                  <Text style={styles.rowMeta}>{row.unitsSold} units sold</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>{formatMoney(row.revenue)}</Text>
                  <Text style={styles.rowMeta}>profit {formatMoney(row.profit)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  padded: { padding: 16 },
  error: { color: "#c00" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthLabel: { fontWeight: "600" },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  card: { flexBasis: "47%", borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 12 },
  cardLabel: { fontSize: 11, color: "#666" },
  cardValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  negative: { color: "#c00" },
  sectionTitle: { fontWeight: "600", marginTop: 16 },
  empty: { color: "#666", fontSize: 13 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  rowName: { fontWeight: "500" },
  rowMeta: { fontSize: 11, color: "#666" },
  rowValue: { fontWeight: "600" },
  rowRight: { alignItems: "flex-end" },
});
```

- [ ] **Step 3: Add a Reports link next to Activity/Settings on the items list**

In `mobile/app/items/index.tsx`, extend the existing `headerLinks` row:

```tsx
      <View style={styles.headerLinks}>
        <Pressable onPress={() => router.push("/activity")}>
          <Text>Activity</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/reports")}>
          <Text>Reports</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings")}>
          <Text>Settings</Text>
        </Pressable>
      </View>
```

- [ ] **Step 4: Type-check and manual verification**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

With `npm run dev` running at the repo root and `npx expo start` in `/mobile`, log in,
tap Reports, navigate a month or two, and confirm all six summary cards and both
breakdown lists match the web `/reports` page for the same month (same database).

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "Add mobile accounting reports screen"
```

---

## Self-Review Notes

- **Spec coverage:** today's revenue, month revenue/COGS/profit, restock cost,
  inventory valuation, revenue-by-day, sales-by-item — all covered in Task 2's cards and
  lists. `GET /api/v1/reports` reuses `reports.ts`/`calendar.ts` unchanged, matching the
  spec's approach. Manual money formatter and 30s `staleTime` per the spec's two
  improvement suggestions are both included (Task 2, Step 1 and Step 2).
- **Type consistency:** `ReportsMonth`/`RevenueByDayEntry`/`ItemSalesSummary` in
  `mobile/src/api/reports.ts` match the JSON shape returned by the Task 1 route exactly.
