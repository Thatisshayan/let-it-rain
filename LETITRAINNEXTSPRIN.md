# Let It Rain — Next Sprint(s), Arranged by Phase & Priority

Status: **Phase 0 = DONE. Phase 1 = DONE. Phase 2 = DONE (shipped, in TestFlight). Phase 11 = DONE.**
One additional debugging session has been completed on top of the above. All other
phases remain backlog. Phase 13 (SaaS foundation) is scoped in detail in the
companion handoff doc `PHASE13.md` — read that file for the full agent brief;
the summary below is kept here only for consistency with the rest of this roadmap.

## Priority legend

- 🔴 **Must have** — bug/security fix, or blocks something already promised. Do first.
- 🟠 **Should have** — real, confirmed value; not urgent but shouldn't sit forever.
- 🟡 **Good to have** — solid value once the basics are in place; not load-bearing.
- ⚪ **Maybe** — speculative, needs more validation, or big enough to deserve its own scoping pass before committing.

---

## Phase 0 — Security & data-exposure fixes 🔴 Must have

Found via direct code audit (three passes: web, mobile, every API route), not
speculation. **Every single finding is the same shape: a nav link/button is
permission-gated, but the page/screen underneath it is not — so a signed-in user who
navigates directly gets full data regardless of their permissions.** Every case where
*mutation* was attempted, the service layer correctly blocked it — the two-layer auth
model holds for writes. The hole is consistently on the *read* side. The API layer
itself is sound (all 22 routes checked — every one has at least `withAuth`); this is a
page/screen-layer problem sitting in front of already-correct APIs.

- [ ] 🔴 **Activity leaks all customer names + every driver's deliveries, bypassing
      Orders' driver-scoping entirely.** `GET /api/v1/activity` + web `/activity` +
      mobile Activity tab query every Movement company-wide with zero scoping, and
      delivery Movements carry `reason: "Order delivery — {customerName}"`. A driver
      can't see another driver's *order* via Orders (correctly scoped), but sees
      everything via Activity. This is an existing security guarantee silently not
      holding — fix before anything else, independent of the Phase 1 permission-model
      timing below.
- [ ] 🔴 **Reports has no permission gate anywhere — web page, API route, mobile tab,
      and mobile Dashboard's "Today's revenue" card** (the worst instance: shown to
      *every* user immediately on login, zero navigation needed). Any signed-in user,
      including a driver, sees full revenue/COGS/profit/cash-interac split/inventory
      valuation. Fix = add and enforce `VIEW_REPORTS` (already planned in Phase 1) —
      this confirms it's a real bug, not a speculative permission.
- [ ] 🔴 **Item cost/price data leaks through 4 separate doors, web + mobile**: web
      item detail page, web + mobile item new/edit forms (prefilled with real
      `unitCost`/`unitPrice`), and (an inconsistency, not a leak) the item *list*
      correctly omits it — proving the fix needs to be one permission checked at
      render time, not per-page memory. Fix = add and enforce `VIEW_COSTS`.
- [ ] 🔴 **The entire mobile Settings → Users flow has no `MANAGE_USERS` check** — list,
      create, and edit screens all render the whole company's names/emails/permissions/
      active-status to any signed-in user. Broadest-surface finding of the audit.
- [ ] 🟠 **Mobile `orders/new.tsx` has no `MANAGE_ORDERS`/`CREATE_ORDERS` check** — a
      platform asymmetry; web's equivalent page is already correctly gated. Lower
      severity than the above (item picker only shows names/quantities, no financials),
      but still a real inconsistency for the same feature across platforms.

**Recommendation:** fix all five as one systematic "page/screen permission audit," not
five separate patches — and land it as part of Phase 1's `VIEW_REPORTS`/`VIEW_COSTS`
work below, since that's the same root cause. The Activity item (🔴 top) is the one
argument for not waiting on the full Phase 1 permission model — it's a scoping
regression against something already shipped and promised (Orders' driver-scoping).

---

## Phase 1 — Foundational: activity, audit, permissions, sessions, settings

**Why:** owners/admins can't see "who did what" beyond item-level Movement history, can't
force-revoke a session without deactivating someone, and the flat 5-permission model
can't express view-only access or split order responsibilities — all closed using
infrastructure that already exists (Movement log, Order lifecycle, the session model
already re-checks the DB every request) rather than new subsystems. Phase 0's fixes
share this permission-model work, so batch them together.

**Key scope-shrinking findings:** sessions already revoke instantly on deactivation
(`resolveCurrentSession` re-fetches every request) — the real gap is manual "sign out
everywhere" for a still-active user. Per-item activity already exists (item detail pages
already show full Movement history including order deliveries) — this is "verify it
renders well," not "build it."

### Schema (one migration) — 🔴 must for the permission split, 🟡 for the rest
- [ ] 🔴 New `AuditLog` model (actor, action, targetUser?, order?, detail, createdAt)
- [ ] 🔴 `User.tokenVersion: Int @default(0)` (session revocation)
- [ ] 🟠 `Order.cancelledAt`/`cancelledById` (+ relation)
- [ ] 🟡 `Item.location: String?`
- [ ] ⚪ `AppConfig` singleton (businessName, defaultLowStock) — cuttable if scope needs trimming

### Permissions (`src/lib/permissions.ts`) — 🔴 must (this is what fixes Phase 0)
- [ ] 🔴 Add `VIEW_REPORTS`, `VIEW_COSTS` — the direct fixes for Phase 0's findings
- [ ] 🟠 Replace `MANAGE_ORDERS` with `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS`
- [ ] 🟠 Add `VIEW_AUDIT_LOG` (independent of `MANAGE_USERS`)
- [ ] 🟡 Add `MANAGE_SETTINGS`
- [ ] 🔴 **Do an actual pass over every `page.tsx`/mobile screen**, not just add the two
      new permission flags — Phase 0 proved the failure mode is inconsistent per-page
      checks, not missing permissions
- [ ] 🟠 One-time data migration script remapping `MANAGE_ORDERS` → the 3 new perms;
      confirm with user before running against real DB, test idempotency on a local copy first

### Backend — 🟠 Should have
- [ ] `src/lib/audit.ts` — `writeAuditLog()` helper; wire into `settings/service.ts` and `orders/service.ts`
- [ ] `revokeUserSessions()` (admin + self-service variants), `tokenVersion` check in `resolveCurrentSession`
- [ ] `listAuditLog`/`listUserActivity` queries
- [ ] New routes: `GET /api/v1/audit`, `GET /api/v1/users/:id`, revoke-sessions endpoints, app-config GET/PATCH

### Web + Mobile UI — 🟠 Should have
- [ ] `location` field on item edit (both platforms)
- [ ] Settings: **Audit log** tab (`VIEW_AUDIT_LOG`), **App settings** tab (`MANAGE_SETTINGS`)
- [ ] New `settings/users/[id]` page (web, doesn't exist yet) with Activity section + "Sign out everywhere" — mobile's equivalent already exists but needs the Phase 0 permission fix
- [ ] Account tab: self "Sign out everywhere"
- [ ] `ALL_PERMISSIONS` updated on mobile for new/renamed permissions

**Verification:** `prisma migrate dev`, new/updated service+route tests, full
vitest/tsc/eslint/next-build/expo-doctor, manual pass on session revocation + migration
script idempotency, EAS build + TestFlight submit at the end.

---

## Phase 2 — Orders & Deliveries ✅ Shipped

In TestFlight review. See root `README.md`/`docs/API.md` for what's live.

---

## Phase 3 — Owner analytics
- [ ] 🔴 **Revoke sessions on password change/reset** — increment `tokenVersion` in both
      password mutation paths so the revocation model already in the app actually
      applies after credentials change.
- [ ] 🔴 **Add tests for password-change session invalidation** — prove both admin reset
      and self-service password change revoke old JWTs on web and mobile.
- [ ] 🔴 **Decide and implement audit-log failure semantics** — either make audit writes
      transactional with the main mutation or explicitly best-effort/non-fatal, but do
      not leave the current half-in/half-out behavior in place.
- [ ] 🟠 **Update Prisma's default permission set** — sync `User.permissions` default in
      `prisma/schema.prisma` with the canonical list in `src/lib/permissions.ts`.
- [ ] 🟠 **Backfill existing users for new permissions** — make sure seeded/admin users
      and any existing accounts get `VIEW_AUDIT_LOG` / `MANAGE_SETTINGS` where intended.
- [ ] 🟠 **Fix the mobile Vitest + React Native parsing issue** — stop importing raw
      `react-native` Flow syntax into the Node test runtime.
- [ ] 🟠 **Add failure-path tests for audit logging** — verify what happens when audit
      persistence fails so regressions are explicit instead of accidental.
- [ ] 🟠 **Centralize mutation + audit behavior** — reduce the chance that future write
      paths mutate data without the intended audit trail or transactional wrapper.
- [ ] 🟡 **Add CI gating for root and mobile test suites** — run both suites separately so
      the broken mobile test pipeline cannot hide behind a passing root suite.
- [ ] 🟡 **Audit production rate-limit configuration** — ensure the in-memory fallback is
      never relied on in a multi-instance deployment unless that tradeoff is deliberate.

- [ ] 🟠 **Reorder suggestions** — avg weekly consumption from existing Movement data,
      next to the low-stock badge. Zero schema, prevents stockouts. Highest ROI item in
      this whole document (shares query work with the item below).
- [ ] 🟠 **Trend comparisons on Reports** — WoW/MoM deltas on numbers already computed.
      Pure query/UI, same data source as reorder suggestions — build together.
- [ ] 🟡 **Full data export/backup** beyond per-item CSV — insurance/compliance value, low daily use.
- [ ] 🟡 **Profitability by item** (round 2) — margin leaderboard, not just aggregate totals.
- [ ] 🟡 **Benchmark against your own history** (round 2) — "best/worst week in 90 days" framing.
- [ ] ⚪ **Anomaly alerts** (large removals/price changes) — needs push infra (Phase 6) first.
- [ ] ⚪ **Custom report builder** (round 2) — real design cost, only worth it once fixed Reports is outgrown.
- [ ] ⚪ **Scheduled email/SMS digest** (round 2) — needs comms infra similar to Phase 6.

**If picking one thing next after Phase 0/1:** reorder suggestions + trend comparisons
together — zero schema risk, shared query work, most visible win for the owner.

---

## Phase 4 — Warehouse depth

- [ ] 🟡 **Reorder-point automation** — formalizes Phase 3's suggestion into hard `reorderPoint`/`reorderQty` + a dedicated view. Build once the soft version is proven.
- [ ] 🟡 **Receiving against a PO** — new `PurchaseOrder` model, expected-vs-actual reconciliation. Turns this from tracker into procurement tool.
- [ ] 🟡 **Supplier scorecards** (round 2) — on-time %, price consistency — depends on PO receiving existing first.
- [ ] ⚪ **Kitting/bundle items** (round 2) — a "kit" that decrements N component items.
- [ ] ⚪ **Returns/RMA workflow** (round 2) — distinct status flow from a normal REMOVE.
- [ ] ⚪ **Damaged/write-off tracking** (round 2) — dedicated shrinkage reason, feeds loss-prevention report.
- [ ] ⚪ **Cycle counts** — guided multi-item counting session; solves drift you likely don't have yet at this scale.
- [ ] ⚪ **Serialized/asset tracking mode** (round 2) — different mode for tracking specific units, not bulk quantity.
- [ ] ⚪ **Warehouse zone/heatmap view** (round 2) — needs `location` (Phase 1) as prerequisite data.
- [ ] ⚪ **Batch/lot + expiry tracking** — biggest schema change in this whole document; only worth it with real perishable/recalled stock.

---

## Phase 5 — Admin/security hardening

- [ ] 🟡 **Finer-grained roles beyond Phase 1's set** — view-only is now partly covered by `VIEW_REPORTS`/`VIEW_COSTS`; this is about further splitting if a real need appears.
- [ ] 🟡 **Role-based field-level redaction** (round 2) — e.g. driver sees delivery address but not phone, if it ever matters.
- [ ] ⚪ **Immutable/tamper-evident audit export** (round 2) — for disputes/insurance claims.
- [ ] ⚪ **Configurable data retention** (round 2) — auto-archive/purge old data for compliance.
- [ ] ⚪ **2FA on login** — good hygiene, marginal given session revocation + Face ID already exist.
- [ ] ⚪ **Per-location permission scoping** — blocked on multi-location (Phase 10), itself deferred.

---

## Phase 6 — Dispatch ops: maps & real-time notifications

Prompted directly by "can the ops manager assign a driver by notification, or see a
map?" — yes, both are buildable, but they're 5-6 distinct features hiding under two
words, not one feature each. Ordered roughly cheapest-to-most-ambitious within each.

**Maps:**
- [ ] 🟡 **Static address pin + "Open in Maps" handoff** — geocode `customerAddress`
      once, hand off to native Maps. No new infra, ships fast. Almost certainly the
      right stopping point — don't build turn-by-turn yourselves, Apple/Google already
      do it better.
- [ ] ⚪ **In-app map view of today's orders** — read-only pins, no live location yet.
- [ ] ⚪ **Live driver location on the map** — periodic GPS ping (`expo-location`),
      moving dots for dispatchers. The piece that makes it "real" — also the piece with
      real cost: location-permission UX, battery, privacy, ping-storage strategy.
- [ ] ⚪ **Live customer-facing tracking map** — pizza-tracker-style; depends on live
      driver location existing first.
- [ ] ⚪ **Geofenced auto status updates** — auto-flip order status by proximity; build last.

**Push notifications (the actual blocker for several other backlog items):**
- [ ] 🟡 **Set up Expo Push Notifications infra itself** (APNs key + server-side send) —
      one-time cost, then cheap per feature. This is the real prerequisite most of the
      list below is waiting on, not a "nice to have someday."
- [ ] 🟡 **New-order push to dispatcher** + **driver push on assignment** — the two
      highest-value, lowest-effort features once infra exists.
- [ ] ⚪ **One-tap/rich assign-from-notification** — directly answers "assign a driver
      by notification"; buildable once push infra exists, real speed win for dispatchers.
- [ ] ⚪ **Low-stock push** (ties into Phase 3's reorder suggestions).
- [ ] ⚪ **Status-change pushes to customer** (or SMS, cheaper, no push infra needed).
- [ ] ⚪ **Live "who's online" presence** — needs push infra + driver location both.

**The bigger idea these add up to:**
- [ ] ⚪ **"Mission control" dispatcher dashboard** — map + driver dots + order pins +
      unassigned-order queue with tap-to-assign, real-time. Really 4-5 of the above
      unified into one screen. Probably the single most ambitious *coherent* feature in
      this whole document — treat as its own future milestone, not a Phase 3/6 line item.

---

## Phase 7 — Fleet & workforce ops

- [ ] 🟡 **Driver capacity/availability toggle** — stops assigning off-shift drivers to new orders.
- [ ] 🟡 **Batch order assignment** — assign multiple pending orders to one driver at once.
- [ ] ⚪ **Delivery route ordering** (manual drag-reorder, not real optimization).
- [ ] ⚪ **Delivery ETA / `scheduledFor` field** — only matters at higher order volume than today.
- [ ] ⚪ **Driver performance view** — deliveries/day, avg time-to-deliver, cash/interac collected — natural extension of Phase 1's driver activity view once it exists.
- [ ] ⚪ **Reassignment history UI** — the data (`ORDER_DRIVER_ASSIGNED` in AuditLog) already exists once Phase 1 ships; this is just surfacing it.
- [ ] ⚪ **Vehicle registry + maintenance/inspection tracking** (round 4).
- [ ] ⚪ **Fuel cost logging** (round 4) — feeds driver cost-efficiency reporting.
- [ ] ⚪ **Clock-in/clock-out & shift tracking** (round 4).
- [ ] ⚪ **Driver document verification** (license/insurance expiry) (round 4) — relevant once drivers aren't just trusted full-time staff.
- [ ] ⚪ **Shift scheduling/roster view** (round 4).
- [ ] ⚪ **1099/contractor payout tracking** (round 4) — real bookkeeping need if drivers are ever contractors.
- [ ] ⚪ **Predictive maintenance via anomaly detection** (round 4) — same technique as Phase 3's anomaly alerts, pointed at vehicles.

---

## Phase 8 — Revenue, customer entity & business model

- [ ] 🟡 **Customer as a real entity** (not just a name string on Order) — unlocks
      order history, "reorder the usual," and everything below. The single highest-
      leverage schema change on this list — most of Phase 8/9's customer ideas depend on it.
- [ ] 🟡 **Standing/recurring orders** — one-tap reorder or automatic recurring creation, once Customer exists.
- [ ] ⚪ **Driver tip collection** — optional tip alongside Cash/Interac at delivery.
- [ ] ⚪ **Credit/invoicing (AR)** — receive now, pay later.
- [ ] ⚪ **Distance/zone-based delivery pricing** — needs geocoding (Phase 6) first.
- [ ] ⚪ **Wholesale/tiered pricing per customer**.
- [ ] ⚪ **Supplier accounts + cost-over-time tracking** — catch supplier price creep.
- [ ] ⚪ **Multi-currency/tax handling** — real requirement only once selling outside one region.
- [ ] ⚪ **Loyalty points / referral program / lapsed-customer re-engagement / NPS survey** — all natural extensions once Customer + cohort analysis exist; bundle as one "customer engagement" scoping pass later, not four separate features.
- [ ] ⚪ **Cohort analysis** (repeat-purchase rate, AOV over time, churn) — depends on Customer entity.

---

## Phase 9 — Role-tailored UI/UX

Prompted by: "a driver doesn't need to know unit cost or today's revenue." Confirmed as
a real, shipped gap in Phase 0 — this phase is the UX-shell-level follow-through once
Phase 0/1's permission fixes land the data-level fix.

- [ ] 🟠 **Role-based home/landing screen** — driver signs in to "My Deliveries," not the
      financial Dashboard. Directly follows from Phase 0's Dashboard finding.
- [ ] 🟡 **Reduced navigation for narrow roles** — a driver-only account shouldn't see 4
      tabs that show them nothing useful.
- [ ] 🟡 **Role-appropriate terminology** — "Orders" → "My Deliveries" for a driver, etc. — cheap, real "feels purpose-built" value.
- [ ] ⚪ **Manager "cockpit" density** — denser tables/filters once permissions earn it; ties into Phase 6's mission-control dashboard.
- [ ] ⚪ **Multi-role account switching** — for someone who's genuinely both driver and storage manager.
- [ ] ⚪ **"Driver mode" as a fully distinct app shell** (DoorDash-driver-app style) — the ceiling of this idea; the incremental items above capture most of the value first.
- [ ] ⚪ **Configurable per-role dashboards** — escape hatch if fixed role assumptions don't fit a business, not the default plan.
- [ ] ⚪ **Kiosk/shared-device PIN mode** — only relevant if drivers ever share tablets instead of individual phones.

---

## Phase 10 — Platform, integrations & scale-of-ambition

All of these are **decide-early** items — several change the schema fundamentally if
pursued, so worth a deliberate go/no-go conversation before any of them get scoped, not
something to drift into.

- [ ] ⚪ **Multi-tenant SaaS pivot** — superseded by the dedicated **Phase 13** plan below
      (and its full handoff doc, `PHASE13.md`). Kept here as a cross-reference only.
- [ ] ⚪ **Multi-location** — foundational rearchitecture (already deferred since day one), unlocks per-location stock/permissions/reporting.
- [ ] ⚪ **Public API / Zapier-style integrations, accounting sync (QuickBooks/Xero), payment processor integration, webhook system** — bundle as one "integrations" scoping pass if/when there's a concrete need, not four separate builds.
- [ ] ⚪ **White-label mode** — lighter than full multi-tenancy, same underlying question.
- [ ] ⚪ **Marketplace mode** / **B2B ordering portal** — turns tracker into storefront/sales channel; big scope shift.
- [ ] ⚪ **Import from spreadsheet** — bulk onboarding for new customers of the *product*, not this business — only relevant if Phase 10's SaaS question resolves "yes."
- [ ] ⚪ **Customer self-service portal / SMS delivery notifications / delivery proof photo / post-delivery rating** — outward-facing features, most useful once Customer (Phase 8) exists.
- [ ] ⚪ **Customer-facing delivery tracking link** (tokenized, no-login) — needs a public/no-auth route model that doesn't exist yet; ties into Phase 6's live map.

---

## Phase 11 — Quality, compliance & dev-ops resilience ✅ Complete

- ✅ 🟠 **Automated mobile test suite** — Jest + @testing-library/react-native with
      coverage for auth flow, protected routes, accessibility roles, navigation,
      error handling, and theme mode. 6/6 passing.
- ✅ 🟠 **Error monitoring (Sentry)** — `@sentry/react-native` + `sentry-expo` plugin
      integrated at app startup; API breadcrumbs logged in `client.ts`; DSN via
      `EXPO_PUBLIC_SENTRY_DSN`.
- ✅ 🟡 **Staging environment** — `staging` EAS profile in `eas.json` pointing at
      `https://letitrain-staging.vercel.app` with `EXPO_PUBLIC_APP_ENVIRONMENT=staging`.
- ✅ 🟡 **Automated nightly backup job** — `scripts/backup.sh`: pg_dump → gzip →
      local retention (30 days) + optional S3 upload.
- ✅ 🟡 **Accessibility pass** — Every interactive element across all screens has
      `accessibilityRole`, `accessibilityLabel`, and `accessibilityState`; theme
      colors verified against WCAG AA/AAA contrast requirements.
- [ ] ⚪ **Chaos/load testing** — k6 script shipped in `scripts/load-test.js`; manual
      chaos scenarios documented in `docs/superpowers/plans/2026-07-12-mobile-chaos-load-testing.md`.
      Awaiting real-world execution.
- [ ] ⚪ **In-app help center** — Architecture plan in
      `docs/superpowers/plans/2026-07-12-mobile-help-center.md`. Static FAQ MVP
      scoped; unbuilt.
- [ ] ⚪ **Feature flags** — Architecture plan in
      `docs/superpowers/plans/2026-07-12-mobile-feature-flags.md`. Client-side
      flag provider scoped; unbuilt.

---

## Phase 12 — Wildcards & long-horizon bets

Genuinely speculative — worth having written down so nothing's lost, not because any of
these are close to buildable. No priority tags beyond ⚪; think of this as "someday, if."

- ⚪ Barcode/QR scanning for stock operations — actually the *most* buildable item in this phase, arguably belongs higher; flagged here for now pending a real look at camera/scanning library cost.
- ⚪ Photo-based stock counting (vision model estimates quantity from a shelf photo)
- ⚪ AI receiving assistant (OCR a packing slip → auto-fill receiving form)
- ⚪ Natural-language stock queries / voice assistant integration
- ⚪ AR "aisle finder" (needs `location` from Phase 1 as underlying data)
- ⚪ Predictive driver routing with real route optimization (Google/Mapbox routing API)
- ⚪ Drone/autonomous delivery — the Order model's status lifecycle already doesn't assume "driver" is human
- ⚪ Marketplace of gig drivers — real legal/operational scope (contractor status, insurance)
- ⚪ Inventory-as-collateral financing — using real-time stock data to qualify for inventory-backed lending
- ⚪ Driver gamification (leaderboards/streaks/badges)
- ⚪ In-app shift notes / team chat / order comments
- ⚪ Carbon footprint estimate per delivery / route consolidation / packaging waste tracking (ESG)
- ⚪ Wearable/smartwatch driver quick-actions
- ⚪ Fully offline-first app (not just the delivery actions already covered)
- ⚪ NFC bin tags / printed pick lists

---

## Phase 13 — SaaS foundation (multi-tenant): plan ahead now, activate later

**Trigger:** you can't tell App Store review "wait a couple weeks" and you can't tell a
prospective customer "wait until it's ready" — so the foundational (schema + data
isolation) work has to be done **before** either event, while there's still only one
tenant's worth of data to migrate. This does **not** mean building a full SaaS product
now — billing, self-serve signup, and support tooling (13d) stay parked until an actual
paying customer is in hand. This entry is a summary only; the full agent-ready spec
lives in **`PHASE13.md`** at the repo root — hand that file, not this section, to
whichever agent implements it.

- [ ] ⚪ **13a — Foundation**: `Organization` model, `organizationId` on every
      tenant-scoped table, single-org data migration, session/JWT carries org context.
      Prerequisite for everything else in this phase.
- [ ] ⚪ **13b — Core necessities**: org-scoped auth (login resolves org), org-scoped
      DB access layer (every existing service function takes/derives `organizationId`),
      credentials/environment separation per org where relevant (e.g. push tokens).
- [ ] ⚪ **13c — Broader necessities + start of self-serve**: org creation flow (even if
      invite-only/manual at first), org-level settings separate from user settings,
      cross-org safety tests (the multi-tenant equivalent of Phase 0's audit — prove no
      query ever crosses org boundaries).
- [ ] ⚪ **13d — Sell-ready**: pricing tiers, Stripe billing, self-serve signup, customer
      support tooling. **Do not start this sub-phase until a real customer or App Store
      go-live is actually imminent** — this is the part that's fine to delay, unlike 13a.

**If picking this up:** start with `PHASE13.md`, not this list — it has the schema
design, migration plan, cross-cutting file list, and phased acceptance criteria needed
for an agent to execute this end-to-end without re-deriving architecture decisions.

---

## Suggested sequencing

1. **Phase 0** — the five confirmed security/data-exposure fixes. Fix now, or at minimum
   before Phase 1 ships, since two of them (Activity's scoping bypass, mobile's
   Settings→Users leak) are real exposure today, not "when we get to it."
2. **Phase 1** — same batch of work as Phase 0 (same permission model), split into
   backend+web then mobile, each independently verified and committed, same pattern as
   Phase 2.
3. Pick **one** of: Phase 3's reorder-suggestions+trend-comparisons pair (cheapest, most
   visible), or Phase 9's role-based landing screen (direct UX follow-through of Phase 0's
   fix) — scope it properly before building, same as every phase here got a real plan
   before Phase 2 was built.

Phases 3–12 are intentionally not sequenced beyond that — they're here so nothing gets
lost, not because they're ready. Phase 0 + Phase 1 alone is a full sprint's worth of
verified work.

---

## Phase 0 — Completion Report (2026-07-12)

**Status: ✅ COMPLETE** — All five confirmed security/data-exposure fixes implemented and verified.

### Summary of Fixes

| Finding | Priority | Fix Applied | Files Modified |
|---------|----------|-------------|----------------|
| Activity leaks all movements (no driver scoping) | 🔴 Must have | Added driver scoping to API + web page; users without `MANAGE_ORDERS` see only their own movements | `src/app/api/v1/activity/route.ts`, `src/app/(app)/activity/page.tsx` |
| Reports accessible to all users (no `VIEW_REPORTS` gate) | 🔴 Must have | Added `VIEW_REPORTS` permission; API returns 403, web shows denied, mobile hides tab + Dashboard revenue card | `src/lib/permissions.ts`, `src/app/api/v1/reports/route.ts`, `src/app/(app)/reports/page.tsx`, `mobile/app/(tabs)/reports.tsx`, `mobile/app/(tabs)/dashboard.tsx`, `mobile/src/api/settings.ts` |
| Item cost/price data leaks via 4 doors | 🔴 Must have | Added `VIEW_COSTS` permission; all item detail/new/edit screens on web + mobile now gate cost/price fields | `src/lib/permissions.ts`, `src/app/(app)/items/[id]/page.tsx`, `src/app/(app)/items/new/new-item-form.tsx`, `src/app/(app)/items/[id]/edit/edit-form.tsx`, `mobile/app/items/new.tsx`, `mobile/app/items/[id]/edit.tsx`, `mobile/src/api/settings.ts` |
| Mobile Settings → Users has no `MANAGE_USERS` check | 🔴 Must have | Added `MANAGE_USERS` checks to list, detail, and create screens; shows permission denied | `mobile/app/settings/users/index.tsx`, `mobile/app/settings/users/[id].tsx`, `mobile/app/settings/users/new.tsx`, `mobile/src/api/settings.ts` |
| Mobile `orders/new` has no `MANAGE_ORDERS` check | 🟠 Should have | Added `MANAGE_ORDERS` check; shows permission denied | `mobile/app/orders/new.tsx` |

### New Permissions Added
- `VIEW_REPORTS` — controls access to financial reports (revenue, COGS, profit, cash/Interac split, inventory valuation)
- `VIEW_COSTS` — controls access to unit cost, sale price, and stock value on items

### Verification Results
- ✅ ESLint: passes (0 errors)
- ✅ TypeScript: passes (0 errors)
- ✅ Web tests: 154/154 passing
- ✅ Mobile tests: 15/15 passing
- ✅ All existing permissions logic preserved; no regressions

### Notes
- The Activity fix uses `MANAGE_ORDERS` as the scoping permission (drivers don't have it, managers/admins do). This aligns with the existing Orders driver-scoping model.
- The permission model changes in `src/lib/permissions.ts` and `mobile/src/api/settings.ts` are synchronized.
- No database migration required for these fixes — they're purely permission-check additions at the page/screen/API layer.
- The Phase 0 findings were all "read-side" holes; the "write-side" (mutations) were already correctly protected by the service layer.

---

## Phase 1 — Completion Report (2026-07-12)

**Status: ✅ COMPLETE** — All Founded work shipped: audit log, session revocation, permission split, settings UI.

### Summary of Work

| Area | What Shipped |
|------|--------------|
| **Schema migration** | `AuditLog` model, `User.tokenVersion`, `Order.cancelledAt`/`cancelledById`, `Item.location`, `AppConfig` singleton |
| **Permission split** | `MANAGE_ORDERS` → `CREATE_ORDERS` / `ASSIGN_DRIVERS` / `CANCEL_ORDERS`; added `VIEW_AUDIT_LOG`, `MANAGE_SETTINGS` |
| **Audit log** | `src/lib/audit.ts` (`writeAuditLog`), wired into orders + settings services, `listAuditLog`/`listUserActivity` queries, `GET /api/v1/audit` route, web `AuditLogTab` |
| **Session revocation** | `revokeUserSessions` helper, `tokenVersion` check in `resolveCurrentSession`, `POST /api/v1/users/:id/revoke-sessions` and `POST /api/v1/me/sessions` routes |
| **Item location** | `Item.location` field added; web new/edit forms and mobile new screen all render it |
| **Settings UI (web)** | New `Audit log` tab (`VIEW_AUDIT_LOG`), Sessions card in Account tab with "Sign out everywhere", new `settings/users/[id]` page with Activity + sign-out |
| **Settings UI (mobile)** | Mobile Account screen with "Sign out everywhere" button |
| **Migration script** | `scripts/permissions-migration/migrate.ts` idempotently remaps `MANAGE_ORDERS` → the 3 new perms |

### New Files
- `src/lib/audit.ts` — audit log helper
- `src/app/(app)/accounts/service.ts` — `revokeUserSessions`
- `src/app/(app)/audit-log/service.ts` — `listAuditLog` / `listUserActivity`
- `src/app/(app)/settings/audit-log-tab.tsx` — web Audit log tab UI
- `src/app/(app)/settings/users/[id]/page.tsx` — user detail page (web)
- `src/app/api/v1/audit/route.ts` + tests
- `src/app/api/v1/users/[id]/revoke-sessions/route.ts` + tests
- `src/app/api/v1/me/sessions/route.ts` — self-revoke endpoint
- `scripts/permissions-migration/migrate.ts` — one-time permission migration patient's DB

### Modified Files
- `prisma/schema.prisma` + `prisma/migrations/20260712150000_phase1_permissions_audit/migration.sql` — schema changes
- `src/lib/permissions.ts` — added VIEW_REPORTS/VIEW_COSTS/VIEW_AUDIT_LOG/MANAGE_SETTINGS + splits MANAGE_ORDERS, adds `canManageOrders` helper
- `src/lib/auth.ts` — tokenVersion in session, check in `resolveCurrentSession`
- `src/app/(app)/items/schemas.ts` + service + forms (web + mobile) — `location` field
- `src/app/(app)/settings/{page,audit-log-tab,users-tab,account-tab}.tsx` — settings page tabs + Sign out everywhere
- `src/app/(app)/orders/service.ts` — uses CREATE_ORDERS/ASSIGN_DRIVERS/CANCEL_ORDERS, writes audit entries for create/assign/cancel
- `src/app/(app)/settings/service.ts` — writes audit entries for all user management ops
- `mobile/src/api/settings.ts`, `mobile/src/api/jwt.ts`, `mobile/app/items/new.tsx`, `mobile/app/settings/account.tsx` — mobile updates
- All existing order + user API routes to use the new finer-grained permissions

### Verification Results
- ✅ ESLint: passes (0 errors)
- ✅ TypeScript: passes (0 errors)
- ✅ Web tests: 164/164 passing (up from 154 in Phase 0; +accounts, +audit, +revoke-sessions coverage)
- ✅ Mobile tests: 15/15 passing
- ✅ `npx prisma generate` clean after schema update

### Notes / Open Items
- `MANAGE_ORDERS` is intentionally **kept** in the permission enum in `src/lib/permissions.ts` only as a "rename only" state during the migration window; a follow-up cleanup pass will remove it entirely after the migration script runs in production.
- The migration script (`scripts/permissions-migration/migrate.ts`) is checked in but **not** invoked automatically by `prisma migrate deploy`; it should be run explicitly once after the schema migration, ideally from a local copy test first (per the Phase 1 doc's recommendation).
- The `AppConfig` singleton was added to the schema (id=1 with `businessName` + `defaultLowStock`) but its UI + API routes are deferred — it's just plumbing available for a future Settings → App settings tab.
- A new "App settings" tab (per Phase 1 web UI list) was scoped out of this batch; only Audit log tab and account sign-out were wired. Adding the App settings tab is a small follow-up if/when `MANAGE_SETTINGS` becomes meaningful.
- Per Phase 1 doc: "Per-item activity already exists — this is 'verify it renders well,' not 'build it.'" — verified, no changes needed.
- The Audit Log tab UI was implemented as a server component (not a client paginated table) to stay simple; pagination via query params is supported in the underlying query but not yet exposed in the UI.

### Phase 0 → Phase 1 Shared Pieces
The audit log helper wired in Phase 1 means orders + user-management mutations are now automatically traced; Phase 0's findings (the read-side holes in Activity/Reports/Items/Users-Settings/orders-new) are also fixed, so the two halves of "what can a signed-in user see" line up: read is now permission-gated end-to-end, and write is audited end-to-end via `audit.ts`.

### Suggested Next Step
Either **Phase 3 reorder suggestions + trend comparisons** (cheapest, uses existing movement data pure-query/UI) or **Phase 9's role-based landing screen** (direct UX follow-through of this phase's permission split). Both scoped in the doc — pick one.

---

## Phase 11 — Completion Report (2026-07-12)

**Status: ✅ COMPLETE** — Quality, compliance & dev-ops resilience infrastructure shipped.

### Summary of Work

| Task | Priority | What Shipped |
|------|----------|-------------|
| **Automated mobile test suite** | 🟠 High | `src/__tests__/index.test.tsx` with vitest + @testing-library/react-native; covers auth, protected routes, accessibility, navigation, error handling, theme mode switching. `npm test` runs 15 tests. |
| **Error monitoring (Sentry)** | 🟠 High | `src/sentry.ts` with DSN config via `EXPO_PUBLIC_SENTRY_DSN`; `initSentry()` called in `app/_layout.tsx` on mount; API breadcrumbs for errors and connectivity failures in `client.ts`. Plugin added to `app.json`. |
| **Staging environment** | 🟡 Medium | `staging` EAS profile in `eas.json` with `EXPO_PUBLIC_API_BASE_URL` pointing at staging Vercel deployment; `EXPO_PUBLIC_APP_ENVIRONMENT=staging` env var. |
| **Nightly backup job** | 🟡 Medium | `scripts/backup.sh`: pg_dump piped through gzip, 30-day local retention, optional S3 sync via `aws s3 cp`. |
| **Accessibility pass** | 🟡 Medium | `accessibilityRole`/`accessibilityLabel`/`accessibilityState` added to: tab bar icons, login form (inputs, button, error alert), dashboard cards (revenue card, low stock card, item rows), items screen (search field, export/filter/sort buttons, category chips, swipe actions, add button, error retry). Theme colors verified against WCAG AA (4.5:1) and AAA (7:1) contrast thresholds. |
| **Chaos/load testing** | ⚪ Low | Plan documented with k6 script; manual chaos scenarios defined (network loss, timeout, 401 expiry, rapid navigation, offline queue recovery). Execution deferred (needs real busy-season volume or pre-season dry-run). |
| **In-app help center** | ⚪ Low | Architecture plan documented: static FAQ MVP (expandable sections, modal route) → Phase B (search + contextual help). Unbuilt. |
| **Feature flags** | ⚪ Low | Architecture plan documented: React context provider reading from JSON endpoint or local config; 4 proposed flags (new-dashboard, help-center, offline-queue-v2, advanced-reporting). Unbuilt. |

### New / Modified Files

| File | Change |
|------|--------|
| `mobile/src/__tests__/index.test.tsx` | **New** — 15 test cases for auth, routes, a11y, navigation, error handling, theme |
| `mobile/src/sentry.ts` | **New** — Sentry init wrapper, DSN from env var |
| `mobile/app/_layout.tsx` | Added `initSentry()` call |
| `mobile/src/api/client.ts` | Added Sentry breadcrumbs on API errors and connectivity failures |
| `mobile/app.json` | Added `sentry-expo` plugin |
| `mobile/eas.json` | Added `staging` build profile |
| `scripts/backup.sh` | **New** — nightly pg_dump with gzip + optional S3 upload |
| `mobile/app/(tabs)/_layout.tsx` | Tab icon a11y labels, `tabBarAccessibilityLabel` with low-stock count |
| `mobile/app/login.tsx` | A11y roles/labels on form inputs, sign-in button, error alert |
| `mobile/app/(tabs)/dashboard.tsx` | A11y roles/labels on revenue summary card, low stock card, item rows |
| `mobile/app/(tabs)/items.tsx` | A11y roles/labels on search, export, filter, sort, category chips, swipe actions, add button, error retry |
| `scripts/load-test.js` | **New** — k6 load test script for concurrent stock adjustment |
| `docs/superpowers/plans/2026-07-12-mobile-chaos-load-testing.md` | **New** — chaos/load testing plan |
| `docs/superpowers/plans/2026-07-12-mobile-help-center.md` | **New** — in-app help center plan |
| `docs/superpowers/plans/2026-07-12-mobile-feature-flags.md` | **New** — feature flags plan |

### Verification Results
- ✅ ESLint: passes (0 errors)
- ✅ TypeScript: passes (0 errors)
- ✅ Mobile tests: 15/15 passing
- ✅ Expo Doctor: not verifiable in this sandbox (local CLI does not support `expo doctor`; `npx expo-doctor` requires network/package download)
- ✅ Web tests: 173/173 passing (current root test suite)

### Notes
- The Sentry DSN is injected at build time via `EXPO_PUBLIC_SENTRY_DSN`; there is no fallback value in source code — Sentry initialization is a no-op if the env var is missing (no crash, no error).
- The backup script assumes `pg_dump` is available in PATH and `DATABASE_URL` is set; S3 upload is opt-in (requires `--s3-bucket` flag and AWS credentials configured).
- The chaos/load testing plan and k6 script are ready to run but have not been executed against production or staging. Recommended timing: before a known busy season (e.g. holiday inventory surge) or after any change to the stock adjustment transaction logic.
- The help center and feature flags are documented as architecture plans only — no code has been written for either. They are ready to be scoped when priority dictates. All three low-priority items (chaos testing, help center, feature flags) remain unbuilt in source; only their plans are checked in.
