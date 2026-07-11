# Mobile App — Phase 3: Activity Calendar (Design)

## Context

Mobile Phases 1 and 2 shipped core inventory (items, movements) and settings/user
management. This phase picks up the activity calendar — a read-only view of stock
movements grouped by day, currently only available on the web at `/activity`. It's the
smallest of the remaining deferred areas: unlike settings, the web page has no Server
Actions to extract, just a direct Prisma query plus a set of already-pure,
framework-agnostic calendar-math functions in `src/app/(app)/activity/calendar.ts`
(`buildMonthGrid`, `groupMovementsByDay`, `parseMonthParam`, `monthRange`,
`adjacentMonth`, `monthLabel`), all already covered by `calendar.test.ts`.

## Goals (Phase 3)

- View a month grid on mobile with a colored net-movement badge per day (matching the
  web page's green/amber/neutral convention for positive/negative/zero net change).
- Navigate between months (prev/next).
- Tap a day to see that day's movements (item name, type, delta, reason, who did it,
  time).

Out of scope: lean accounting/reports (the final remaining phase); no create/edit
actions — this is read-only, matching the web page exactly.

## Approach

Add one new read-only Route Handler that reuses the existing `calendar.ts` functions
unchanged, plus two mobile screens (month grid, with an inline/expanding day view — no
extra round-trip per day tap, since the month's movements are already fetched in one
request and filtered client-side, matching how the web page already works with its
`day` query param on the same month fetch).

### API surface (phase 3)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/activity?month=YYYY-MM` | any signed-in user | month grid + per-day net/count summaries + full month's movement list |

No permission gate beyond being signed in — matches the web page, which has no
permission check on `/activity`.

Response shape:

```json
{
  "year": 2026,
  "month": 7,
  "monthLabel": "July 2026",
  "weeks": [[{ "date": "2026-06-28", "inMonth": false }, ...], ...],
  "days": { "2026-07-11": { "net": 12, "count": 3 } },
  "movements": [
    {
      "id": "...", "itemId": "...", "itemName": "Widget",
      "type": "RECEIVE", "delta": 10, "reason": null,
      "userName": "Admin", "createdAt": "2026-07-11T03:12:29.893Z"
    }
  ]
}
```

`weeks` and the per-day summaries come directly from `buildMonthGrid` and
`groupMovementsByDay` (serialized: the `Map` from `groupMovementsByDay` becomes a plain
object keyed by date string). `movements` is the same `prisma.movement.findMany` query
the web page already runs for the month, with `item`/`user` relations selected.

### Mobile app structure

- New "Activity" entry point alongside the existing "Settings" link on the items list
  header (`mobile/app/items/index.tsx`).
- `/activity` screen: month grid using `Pressable` day cells in a `FlatList`/grid layout,
  background color keyed off `days[date].net` (positive/negative/zero, same three-way
  split as web), prev/next month buttons re-fetching via React Query with the new
  `month` param. Tapping a day filters the already-fetched `movements` array by date and
  shows the list inline below the grid (no separate API call).
- Typed API client in `mobile/src/api/activity.ts`, mirroring the shape of
  `mobile/src/api/items.ts`.

### Error handling

Standard `{ error }` JSON; 401 if unauthenticated. No other failure modes beyond
malformed `month` query param, which falls back to the current month exactly as
`parseMonthParam` already does for the web page.

### Testing

- Vitest test for the new Route Handler: auth check (401), default-to-current-month
  behavior when `month` is omitted/malformed, and correct shape of the response for a
  given month's movements (reusing a mocked `prisma.movement.findMany`).
- `calendar.ts`'s existing `calendar.test.ts` needs no changes — the functions are
  reused unchanged.
- Mobile: manual Expo Go verification — navigate months, tap a day with movements, tap a
  day with none, confirm parity with the web `/activity` page for the same month (same
  database).

## Verification

- `npm test` covers the new route handler test alongside all existing suites, including
  the unchanged `calendar.test.ts`.
- Manual: with the dev server running, curl `/api/v1/activity` and
  `/api/v1/activity?month=YYYY-MM` with a valid bearer token, confirm the shape and that
  net/count per day match what the web `/activity` page shows for the same month.
- Manual: in the mobile app, open Activity, navigate to a month with known movements
  (e.g. from Phase 1/2 testing), confirm the grid's colored badges and day drill-down
  match the web page.
