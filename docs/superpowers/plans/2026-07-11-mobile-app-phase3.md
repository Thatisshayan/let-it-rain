# Mobile App Phase 3 (Activity Calendar) Implementation Plan

> **For agentic workers:** Execute inline, task by task, in the current session. No subagent dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/v1/activity` and a mobile Activity screen showing a month calendar of stock movements with day drill-down, reusing the existing `calendar.ts` pure functions unchanged.

**Architecture:** One new read-only Route Handler wrapping the existing Prisma query + `calendar.ts` helpers (no service-layer extraction needed — no mutations here). Mobile adds an Activity screen fetching one month at a time via React Query.

**Tech Stack:** Same as Phases 1–2 — Next.js Route Handlers, existing `calendar.ts` helpers, Expo Router + React Query.

---

## Task 1: `GET /api/v1/activity`

**Files:**
- Create: `src/app/api/v1/activity/route.ts`
- Test: `src/app/api/v1/activity/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/activity/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { movement: { findMany: vi.fn() } },
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

describe("GET /api/v1/activity", () => {
  it("returns 401 without a token", async () => {
    const res = await GET(new Request("http://localhost/api/v1/activity"));
    expect(res.status).toBe(401);
  });

  it("returns the requested month's grid, day summaries, and movements", async () => {
    (prisma.movement.findMany as any).mockResolvedValue([
      {
        id: "m1",
        itemId: "i1",
        item: { id: "i1", name: "Widget" },
        type: "RECEIVE",
        delta: 10,
        reason: null,
        user: { name: "Admin" },
        createdAt: new Date("2026-07-11T03:12:29.893Z"),
      },
    ]);
    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/activity?month=2026-07", {
        headers: { authorization: `Bearer ${t}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2026);
    expect(body.month).toBe(7);
    expect(body.weeks.length).toBeGreaterThan(0);
    expect(body.days["2026-07-11"]).toEqual({ net: 10, count: 1 });
    expect(body.movements).toHaveLength(1);
    expect(body.movements[0]).toEqual(
      expect.objectContaining({ id: "m1", itemId: "i1", itemName: "Widget", type: "RECEIVE", delta: 10 })
    );
  });

  it("defaults to the current month when month is omitted", async () => {
    (prisma.movement.findMany as any).mockResolvedValue([]);
    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/activity", { headers: { authorization: `Bearer ${t}` } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toEqual(expect.any(Number));
    expect(body.month).toEqual(expect.any(Number));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/activity/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/activity/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/auth";
import {
  parseMonthParam,
  monthLabel,
  monthRange,
  buildMonthGrid,
  groupMovementsByDay,
} from "@/app/(app)/activity/calendar";

export async function GET(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);

  const movements = await prisma.movement.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
    include: { item: { select: { id: true, name: true } }, user: { select: { name: true } } },
  });

  const byDay = groupMovementsByDay(movements);
  const weeks = buildMonthGrid(year, month);

  return NextResponse.json({
    year,
    month,
    monthLabel: monthLabel(year, month),
    weeks,
    days: Object.fromEntries(byDay),
    movements: movements.map((m) => ({
      id: m.id,
      itemId: m.item.id,
      itemName: m.item.name,
      type: m.type,
      delta: m.delta,
      reason: m.reason,
      userName: m.user.name,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/activity/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites (existing + new), including unchanged `calendar.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v1/activity
git commit -m "Add GET /api/v1/activity"
```

---

## Task 2: Mobile Activity screen

**Files:**
- Create: `mobile/src/api/activity.ts`
- Create: `mobile/app/activity.tsx`
- Modify: `mobile/app/items/index.tsx` (add an Activity link next to the Settings link)

- [ ] **Step 1: Typed activity API calls**

```ts
// mobile/src/api/activity.ts
import { apiFetch } from "./client";

export type MonthCell = { date: string; inMonth: boolean };

export type ActivityMovement = {
  id: string;
  itemId: string;
  itemName: string;
  type: "RECEIVE" | "REMOVE" | "ADJUST";
  delta: number;
  reason: string | null;
  userName: string;
  createdAt: string;
};

export type ActivityMonth = {
  year: number;
  month: number;
  monthLabel: string;
  weeks: MonthCell[][];
  days: Record<string, { net: number; count: number }>;
  movements: ActivityMovement[];
};

export async function fetchActivity(month?: string): Promise<ActivityMonth> {
  const qs = month ? `?month=${month}` : "";
  return apiFetch(`/api/v1/activity${qs}`);
}

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function adjacentMonthParam(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthParam(d.getUTCFullYear(), d.getUTCMonth() + 1);
}
```

- [ ] **Step 2: Activity screen**

```tsx
// mobile/app/activity.tsx
import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchActivity, monthParam, adjacentMonthParam } from "../src/api/activity";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityScreen() {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity", month],
    queryFn: () => fetchActivity(month),
  });

  function goToMonth(delta: number) {
    if (!data) return;
    setSelectedDay(null);
    setMonth(adjacentMonthParam(data.year, data.month, delta));
  }

  if (isLoading || !data) return <Text style={styles.padded}>Loading...</Text>;
  if (error) return <Text style={[styles.padded, styles.error]}>Could not load activity.</Text>;

  const dayMovements = selectedDay ? data.movements.filter((m) => m.createdAt.startsWith(selectedDay)) : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => goToMonth(-1)}>
          <Text>← Prev</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{data.monthLabel}</Text>
        <Pressable onPress={() => goToMonth(1)}>
          <Text>Next →</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={styles.weekdayLabel}>
            {w}
          </Text>
        ))}
      </View>

      {data.weeks.map((week, i) => (
        <View key={i} style={styles.weekRow}>
          {week.map((cell) => {
            const summary = data.days[cell.date];
            const dayNum = Number(cell.date.slice(-2));
            const bg = !summary
              ? undefined
              : summary.net > 0
                ? styles.cellPositive
                : summary.net < 0
                  ? styles.cellNegative
                  : styles.cellNeutral;
            return (
              <Pressable
                key={cell.date}
                style={[styles.cell, cell.inMonth ? undefined : styles.cellOutOfMonth, bg]}
                onPress={() => setSelectedDay(cell.date)}
              >
                <Text style={styles.cellDay}>{dayNum}</Text>
                {summary ? (
                  <Text style={styles.cellNet}>
                    {summary.net > 0 ? "+" : ""}
                    {summary.net}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {selectedDay ? (
        <View style={styles.dayDetail}>
          <Text style={styles.dayTitle}>{selectedDay}</Text>
          {dayMovements.length === 0 ? (
            <Text>No stock movements on this day.</Text>
          ) : (
            <FlatList
              data={dayMovements}
              keyExtractor={(m) => m.id}
              renderItem={({ item: m }) => (
                <View style={styles.movementRow}>
                  <Text>
                    {m.itemName} — {m.type} ({m.delta > 0 ? "+" : ""}
                    {m.delta}) by {m.userName}
                  </Text>
                  {m.reason ? <Text style={styles.movementReason}>{m.reason}</Text> : null}
                </View>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  padded: { padding: 16 },
  error: { color: "#c00" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthLabel: { fontWeight: "600" },
  weekdayRow: { flexDirection: "row" },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 12, color: "#666" },
  weekRow: { flexDirection: "row", gap: 2, marginBottom: 2 },
  cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee", borderRadius: 6 },
  cellOutOfMonth: { opacity: 0.3 },
  cellPositive: { backgroundColor: "#d1fae5" },
  cellNegative: { backgroundColor: "#fee2e2" },
  cellNeutral: { backgroundColor: "#e0f2fe" },
  cellDay: { fontSize: 12, fontWeight: "500" },
  cellNet: { fontSize: 9, fontWeight: "600" },
  dayDetail: { marginTop: 12, gap: 4 },
  dayTitle: { fontWeight: "600" },
  movementRow: { paddingVertical: 6, borderBottomWidth: 1, borderColor: "#eee" },
  movementReason: { fontSize: 12, color: "#666" },
});
```

- [ ] **Step 3: Add an Activity link next to Settings on the items list**

In `mobile/app/items/index.tsx`, add the import and a second header link alongside the
existing Settings `Pressable`:

```tsx
      <View style={styles.headerLinks}>
        <Pressable onPress={() => router.push("/activity")}>
          <Text>Activity</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings")}>
          <Text>Settings</Text>
        </Pressable>
      </View>
```

Replace the existing standalone Settings `Pressable`/`settingsLink` block with this, and
add to the file's `StyleSheet.create`:

```ts
  headerLinks: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
```

(remove the now-unused `settingsLink` style entry).

- [ ] **Step 4: Type-check and manual verification**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

With `npm run dev` running at the repo root and `npx expo start` in `/mobile`, log in,
tap Activity, navigate a month or two, tap a day with known movements (from earlier
Phase 1/2 testing) and confirm the movement list matches, tap a day with none and
confirm the empty state. Compare against the web `/activity` page for the same month.

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "Add mobile activity calendar screen"
```

---

## Self-Review Notes

- **Spec coverage:** month grid with net-change badges, prev/next navigation, day
  drill-down with movement details — all covered in Task 2. `GET /api/v1/activity`
  reuses `calendar.ts` unchanged, matching the spec's approach. No mutation endpoints,
  matching the spec's read-only scope.
- **Type consistency:** `ActivityMonth`/`ActivityMovement` in
  `mobile/src/api/activity.ts` match the JSON shape returned by the Task 1 route
  exactly (including `days` as a plain object, not a Map, since JSON has no Map type).
