# Mobile App — Phase 4: Lean Accounting & Reports (Design)

## Context

This is the final deferred area from the original mobile-parity scope. Phases 1–3
shipped core inventory, settings/user management, and the activity calendar. The web
`/reports` page — today's revenue, month revenue/COGS/profit, restock cost, current
inventory valuation, and revenue/sales breakdowns — is the last piece left before mobile
has full feature parity with the web app.

Like the activity calendar (Phase 3), this page has no Server Actions to extract: it's a
read-only view built from direct Prisma queries plus already-pure, framework-agnostic
functions in `src/app/(app)/reports/reports.ts` (`totalRevenue`, `totalCogs`,
`totalRestockCost`, `revenueByDay`, `salesByItem`), all reused unchanged. It also reuses
`calendar.ts`'s month-parsing helpers, the same way `/api/v1/activity` (Phase 3) already
does.

## Goals (Phase 4)

- View, on mobile: today's revenue, this month's revenue/COGS/gross profit, this
  month's restock cost, current inventory valuation (all items, live), a revenue-by-day
  list for the selected month, and a sales-by-item breakdown (units sold, revenue,
  profit) for the selected month.
- Navigate between months, same pattern as the Activity screen (Phase 3).

Out of scope: none remaining after this — this closes out the full deferred scope from
the original web app (settings, calendar, accounting/reports).

## Approach

One new read-only Route Handler wrapping the existing Prisma queries + `reports.ts` /
`calendar.ts` pure functions, plus one new mobile screen.

### API surface (phase 4)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/reports?month=YYYY-MM` | any signed-in user | matches web: no permission gate beyond being signed in |

Response shape:

```json
{
  "year": 2026, "month": 7, "monthLabel": "July 2026",
  "todayRevenue": 42.50,
  "monthRevenue": 1200.00, "monthCogs": 800.00, "monthProfit": 400.00,
  "monthRestockCost": 300.00,
  "inventoryValuation": 5400.00,
  "revenueByDay": [{ "date": "2026-07-11", "revenue": 42.50 }],
  "salesByItem": [
    { "itemId": "...", "itemName": "Widget", "unitsSold": 12, "revenue": 84.00, "cogs": 36.00, "profit": 48.00 }
  ]
}
```

`revenueByDay` is the `Map` from `revenueByDay()` serialized as an array sorted newest
first (matching the web page's `daysWithSales` sort). `salesByItem` comes directly from
`salesByItem()`, already sorted by revenue descending. The route runs the same three
Prisma queries the web page already runs (month movements filtered to sales/receives,
today's sale movements, current item quantities/costs for valuation), in parallel via
`Promise.all`, exactly as the web page does.

### Mobile app structure

- **Reports** screen (`/reports`), reachable from a third header link on the items list
  alongside Activity and Settings (from Phases 2–3).
- Layout, top to bottom: summary cards (today's revenue, month revenue, COGS, gross
  profit, restock cost, inventory valuation), prev/next month controls (same pattern as
  the Activity screen), revenue-by-day list, sales-by-item list — same content and order
  as the web page.
- **Money formatting**: a small manual `formatMoney(n)` helper (`$` + fixed 2 decimals,
  thousands separator) instead of `toLocaleString('en-US', {style:'currency',...})` —
  Hermes/older RN runtimes can ship a stripped-down `Intl`, and this is the first mobile
  screen displaying real financial figures, so a manual formatter avoids relying on
  runtime `Intl` support.
- **Cache freshness**: the React Query call for this screen sets a short `staleTime`
  (30s) so financial figures don't visibly go stale if a user leaves the screen open
  without navigating away — everything still stays in-memory only, nothing persisted to
  disk.

### Error handling

Standard `{ error }` JSON; 401 if unauthenticated. No other failure modes beyond
malformed `month`, which falls back to the current month exactly as
`parseMonthParam` already does.

### Testing

- Vitest test for the new Route Handler: auth check (401), correct month
  defaulting/parsing, and correct aggregation into the response shape given a mocked set
  of movements and items (mirroring the web page's own query/aggregation logic).
- `reports.ts`'s existing logic is reused unchanged (its own test coverage, if any,
  needs no changes).
- Mobile: manual Expo Go verification — compare the mobile Reports screen against the
  web `/reports` page for the same month (same database), confirming all six summary
  figures and both breakdown lists match exactly.

## Verification

- `npm test` covers the new route handler test alongside all existing suites.
- Manual: with the dev server running, curl `/api/v1/reports` and
  `/api/v1/reports?month=YYYY-MM` with a valid bearer token, confirm the numbers match
  what the web `/reports` page shows for the same month (cross-check against known test
  data from earlier phase verification, e.g. the Phase 1/2 test movements).
- Manual: in the mobile app, open Reports, navigate months, confirm all six summary
  cards and both breakdown lists render correctly and match the web page.
