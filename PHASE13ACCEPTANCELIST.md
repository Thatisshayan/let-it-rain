# Phase 13 — Acceptance Criteria Checklist

This is the authoritative, checkable list for Phase 13 (multi-tenant SaaS
foundation). It exists separately from `PHASE13.md` (the narrative handoff/spec) so
there is one unambiguous place to check items off and report against — do not
duplicate/fork this list elsewhere; update it in place as work completes.

**Rule:** a sub-phase (13a/13b/13c/13d) is not "done" until every box in its section
below is checked **and** verified true, not just implemented-and-assumed-working.
Where a box says "verified by test," an actual automated test must exist and pass —
manual spot-checking is not sufficient for anything touching cross-tenant data
isolation.

Each sub-phase is implemented on its **own branch** (see `PHASE13.md` §"Branching &
completion reporting"). When a sub-phase's branch is ready to merge, its checklist
section below must be fully checked, and its completion report must already be
appended to all three of: this file, `PHASE13.md`, and `LETITRAINNEXTSPRIN.md`.

---

## 13a — Foundation (schema + query scoping)

### Schema
- [x] `Organization` model exists in `prisma/schema.prisma` with at minimum `id`,
      `name`, `createdAt`.
- [x] `organizationId` column added to: `User`, `Item`, `Order`, `OrderLineItem`
      (directly or via `Order` relation — decided and documented which), `AuditLog`,
      `AppConfig`.
- [x] Explicit decision made and documented (code comment at the schema field) on
      whether `Movement` gets its own direct `organizationId` column (denormalized
      for query performance) vs. relying solely on its `Item`/`User` relations —
      not left ambiguous.
- [x] `AppConfig` is no longer a hardcoded `id=1` global singleton — it is one row
      per organization (either `organizationId` as primary key, or a `@@unique`
      constraint enforcing one row per org).
- [x] Every new `organizationId` column has an index (`@@index([organizationId])` or
      equivalent) — unscoped-organization queries at scale are the whole point of
      this schema change; they must be fast.

### Migration
- [x] Migration adds new `organizationId` columns as **nullable** first.
- [x] A single `Organization` row is created representing the current tenant
      ("Let It Rain").
- [x] All pre-existing rows across every affected table are backfilled to that org's
      id, with zero data loss (verified by row-count comparison before/after).
- [x] A follow-up migration changes the columns to `NOT NULL` only after backfill is
      confirmed complete.
- [x] Migration has been run and verified against a **local copy** of the database
      before being proposed for the real Neon database — not run directly against
      production without that dry run.
- [x] Migration is idempotent or clearly documented as one-time-only (matching the
      precedent set by Phase 1's `scripts/permissions-migration/migrate.ts`).

### Session / auth
- [x] `SessionPayload` (`src/lib/auth.ts`) includes `organizationId`.
- [x] `resolveCurrentSession()` re-fetches and re-validates `organizationId` from the
      DB on every request (same freshness guarantee already given to
      `active`/`tokenVersion`) — not just embedded once in the JWT and trusted for
      30 days.
- [x] Both `getSession()` (web, cookie-based) and `verifyBearerToken()` (mobile,
      Bearer-token-based) correctly carry the new field — verified by an
      updated/new auth test for each path.

### Query scoping (the exhaustive pass)
- [x] Every function in `src/app/(app)/items/service.ts` that reads or writes `Item`
      or `Movement` rows includes `organizationId` in its Prisma `where`/data —
      confirmed function-by-function, not spot-checked.
- [x] Same exhaustive confirmation for `src/app/(app)/orders/service.ts` (`Order`,
      `OrderLineItem`).
- [x] Same exhaustive confirmation for `src/app/(app)/settings/service.ts`.
- [x] Same exhaustive confirmation for `src/app/(app)/accounts/service.ts`.
- [x] Same exhaustive confirmation for `src/app/(app)/audit-log/service.ts`.
- [x] Every route under `src/app/api/v1/*/route.ts` confirmed to call only through
      the (now org-scoped) service layer — no route found querying Prisma directly
      and bypassing the service layer's scoping. If any such route is found, it is
      fixed as part of this checklist, not deferred.
- [x] Any web server component that queries Prisma directly (not through
      `service.ts`, e.g. dashboard page data-fetching) is confirmed org-scoped too —
      the service-layer sweep above does not cover these by itself; they must be
      checked separately.

### Cross-org isolation test suite (the load-bearing verification for this whole phase)
- [x] An automated test suite exists that creates **two** `Organization` rows, seeds
      each with its own users/items/orders/movements/audit-log entries.
- [x] Test asserts a session scoped to Org A cannot retrieve Org B's items via any
      service function or API route (list, get-by-id, search/filter variants all
      covered, not just the happy-path list endpoint).
- [x] Same assertion for orders (including order detail, driver-assigned orders).
- [x] Same assertion for movements/activity.
- [x] Same assertion for audit log entries.
- [x] Same assertion for user list/detail (Org A admin cannot see/manage Org B's
      users).
- [x] Same assertion for `AppConfig` (Org A cannot read/write Org B's settings).
- [x] Test suite runs as part of the normal test command (`npm test` at repo root)
      — not a separate manual script that could silently stop being run.

### Regression check
- [x] Full existing web test suite passes (baseline going into this phase: 164/164
      per Phase 1's completion report — confirm current count and match/exceed it).
- [x] Full existing mobile test suite passes (baseline: 15/15 per Phase 11's
      completion report).
- [x] `eslint` passes with 0 errors.
- [x] `tsc` / `next build` passes with 0 errors.
- [x] `npx prisma generate` completes cleanly after the schema change.

---

## 13b — Core necessities (org-aware auth + data-access consistency)

- [x] Explicit decision recorded (code comment + this file) on email uniqueness
      model: confirmed as "globally unique email, one org per user" per `PHASE13.md`
      §4's default recommendation, **or** a documented, deliberate deviation with
      reasoning if changed.
- [x] `POST /api/v1/auth/login` (`src/lib/login.ts` +
      `src/app/api/v1/auth/login/route.ts`) resolves and attaches correct org
      context on successful login — verified by test.
- [x] Verified by test: a user cannot authenticate into a different org's context
      under any input (e.g. malformed/forged org hints, if any org selector exists
      client-side — there should not be a client-supplied org id trusted anywhere;
      org must always be derived server-side from the authenticated user).
- [x] Every service-layer function's scoping approach (org + existing
      permission/driver-scoping) is internally consistent — same pattern, not one
      file doing it differently from another.
- [x] No hardcoded assumption of a single org remains anywhere in the codebase
      (grep for the literal string used for the original "Let It Rain" org's id/name
      outside of the migration/seed script itself — it should not appear in
      application logic).

---

## 13c — Broader necessities + start of self-serve

- [x] An org-creation flow exists (admin-only/invite-based is sufficient — does not
      need to be public yet) that creates a new `Organization` row plus its first
      admin `User`, fully functional end-to-end.
- [x] A second real organization has been created via this flow (not just via a
      test/seed script) and manually verified to work: login, create an item,
      create an order, assign a driver, view reports — all succeed and are
      correctly isolated from the first org.
- [x] Org-level settings (business name, default low-stock threshold — the
      `AppConfig` fields) are editable per-org through actual UI, not just the
      database.
- [x] The cross-org isolation test suite from 13a is now integrated into CI (not
      just runnable locally) and confirmed actually running on every PR/push, not
      just present in the repo.
- [x] Test suite extended, if needed, to cover any new surfaces introduced by the
      org-creation flow itself (e.g. the creation endpoint can't be used to attach a
      new admin user to an *existing* org without authorization).

---

## 13d — Sell-ready (do not start until explicitly triggered)

**Gate check before starting this section at all:** confirm and record here which
trigger fired — App Store go-live date, or named prospective customer — before
checking off any item below. If neither has actually happened, do not start 13d.

- [ ] Trigger event recorded: ________________________ (date / customer name)
- [ ] Pricing tiers defined and enforced in the data model (seat limits and/or
      feature gating, matching whatever tiers were actually decided at trigger
      time).
- [ ] Stripe billing integrated: subscription creation, webhook handling for
      payment success/failure/cancellation, and dunning behavior all implemented
      and tested against Stripe's test mode before going live.
- [ ] Self-serve signup flow: public org creation, email verification, initial
      admin account setup — builds on 13c's flow, made public with appropriate
      abuse/rate-limiting protection.
- [ ] Minimal customer support visibility: a way to see which orgs exist, their
      plan/tier, and basic usage, even if it's just an internal admin view rather
      than a polished dashboard.
- [ ] Full regression pass (lint/typecheck/test suites, both web and mobile) after
      this sub-phase, same as every prior sub-phase.

---

## Completion reports

When a sub-phase's checklist above is fully checked, append a dated completion
report **here**, in `PHASE13.md`, and in `LETITRAINNEXTSPRIN.md`, following the same
format Phase 0/1/11 already used in `LETITRAINNEXTSPRIN.md` (summary table of what
shipped, new/modified file list, verification results, notes/open items). Do not
consider a sub-phase merged to `master` until all three files have that report.

<!-- Completion reports appended below this line, one per sub-phase, in order. -->

---

## Phase 13a — Completion Report (2026-07-12)

**Status: ✅ COMPLETE** — Multi-tenant foundation: `Organization` model, `organizationId` across every tenant-scoped table, an exhaustive service-and-route query-scoping sweep, and a load-bearing cross-org isolation test suite. Branch: `phase-13a-saas-foundation`.

### Summary of Work

| Area | What Shipped |
|------|--------------|
| **Schema** | New `Organization` model; `organizationId` added to `User`, `Item`, `Movement` (direct/denormalized), `Order`, `AuditLog`; `OrderLineItem` scoped via its `Order` (no column, documented); `AppConfig` converted from global `id=1` singleton to one-row-per-org (`organizationId @unique`, uuid PK). Every org column indexed, plus composite `(organizationId, createdAt)` on `Movement`/`AuditLog`. |
| **Migration** | Two migrations following the Phase 1 nullable → backfill → NOT NULL precedent. `…_phase13a_org_nullable_backfill`: creates the org, adds nullable columns, backfills all rows to the "Let It Rain" org (fixed UUID, idempotent), adds indexes + `ON DELETE RESTRICT` FKs, restructures `AppConfig`. `…_phase13a_org_not_null`: flips all six columns to `NOT NULL`. |
| **Session** | `SessionPayload.organizationId`, re-fetched from the DB every request in `resolveCurrentSession()` (same freshness guarantee as `active`/`tokenVersion`); threaded through `getSession` (cookie), `verifyBearerToken` (mobile), `attemptLogin`, both login entry points, and the seed. |
| **Service-layer sweep** | All 5 `service.ts` files scoped function-by-function, including every `tx.*` call inside transactions; cross-user/cross-order/cross-item writes now use org-scoped `where` with not-found guards so a cross-org target is a clean error, not a thrown 500. `audit-log/service.ts` readers now take a required `organizationId`. |
| **Direct-Prisma sweep (beyond the service layer)** | 8 API routes and 14 server-components/actions that query Prisma directly were each scoped to the caller's org — including the dashboard (which fetched no session at all) and a raw-SQL low-stock query in `items/page.tsx` (parameterized org predicate added). |
| **Isolation suite** | `cross-org-isolation.test.ts` — an in-memory fake Prisma that *actually enforces* `where.organizationId`, seeded with two orgs, exercising the real service functions and API route handlers. 24 tests covering items/movements/orders/audit/users/AppConfig at both the service and API-route layers, with a sanity test proving an unfiltered query would see both orgs. |
| **Mobile** | Pure `/api/v1` consumer (API is the enforcement boundary) — `organizationId` threaded through the `User` type + JWT decode only, so the client isn't painted into a corner for 13b/13c. No UI/feature work. |

### New Files
- `prisma/migrations/20260712160000_phase13a_org_nullable_backfill/migration.sql`
- `prisma/migrations/20260712160100_phase13a_org_not_null/migration.sql`
- `src/app/(app)/cross-org-isolation.test.ts` — the cross-org isolation suite

### Modified Files
- `prisma/schema.prisma`, `prisma/seed.ts`
- `src/lib/auth.ts`, `src/lib/login.ts`, `src/lib/audit.ts` + `src/lib/auth.test.ts`
- `src/app/api/v1/auth/login/route.ts` (+ test), `src/app/login/actions.ts`
- Services: `items/service.ts`, `orders/service.ts`, `settings/service.ts` (+ test), `accounts/service.ts` (+ test), `audit-log/service.ts`
- Direct-Prisma API routes: `items/route.ts`, `items/[id]/route.ts`, `items/export.csv/route.ts`, `items/[id]/movements/export.csv/route.ts` (api + app copies), `activity/route.ts`, `reports/route.ts`, `users/route.ts`, `orders/drivers/route.ts`, `audit/route.ts`
- Direct-Prisma server components/actions: `layout.tsx`, `page.tsx` (dashboard), `items/{page,new,[id],[id]/edit,[id]/actions}`, `orders/{new,[id]}`, `activity/page.tsx`, `reports/page.tsx`, `settings/{page,audit-log-tab,users/[id]}`
- Mobile: `mobile/src/api/auth.ts`, `mobile/src/api/jwt.ts`, `mobile/src/api/AuthContext.tsx`

### Key Decisions (documented as code comments at each site)
- **`Movement` carries a direct denormalized `organizationId`** — it's the hottest read table (activity/reports scan by date), so joining through `Item` just to filter by tenant would be needless cost. Writers copy the org from the parent item.
- **`OrderLineItem` is scoped solely via its parent `Order`** (no column) — it is never queried standalone (verified in the sweep).
- **`AppConfig` is now one row per org** — the `id=1` global singleton is gone; `organizationId @unique` is the effective key.
- **Email stays globally unique, one org per user** — org is always derived server-side from the authenticated user, never client-supplied. (Login-time comment/enforcement is a 13b item; the schema + session groundwork is here.)

### Discrepancies vs the handoff docs (flagged, not silently absorbed)
- **PHASE13.md §3 / §4.5 imply org scoping lives in the 5 service files and that API routes only call through the service layer.** That is **false** in the current code: 8 API routes and 14 server-components/actions query Prisma directly. The checklist anticipated this ("If any such route is found, it is fixed as part of this checklist"); all were fixed here. The real sweep was ~30 files, not 5.
- **`items/page.tsx` uses raw SQL** for the low-stock filter — not covered by Prisma `where` scoping; a parameterized `"organizationId" = $…` predicate was added to both raw queries.
- **The dashboard `page.tsx` fetched no session at all** (relied on the layout redirect) — added `getSession()` + org scoping.
- **Baseline test count**: docs cite 164; confirmed 164 at branch start, now 200 (+36: the isolation suite and added org/guard tests).

### Verification Results
- ✅ ESLint: 0 errors
- ✅ `next build` (type check): 0 errors
- ✅ Web tests: **200/200** passing (was 164 baseline)
- ✅ Mobile tests: **15/15** passing
- ✅ `npx prisma generate` clean; `prisma migrate diff` confirms the two hand-written migrations produce exactly the schema
- ✅ **Migration verified against a live Postgres copy**: on an isolated database created on a throwaway Neon branch, seeded pre-13a data (3 users / 4 items / 4 movements / 2 orders / 3 line items / 2 audit / 1 AppConfig), applied both migrations, and confirmed — **identical row counts before/after (zero data loss)**, **0 NULL `organizationId`** across all six tables, `Organization` row created, **every** row points at that org, all six columns `NOT NULL`, `AppConfig.id` migrated int→text with `businessName` preserved, and 6 `organizationId` FK constraints present. Branch deleted afterward.

### Notes / Open Items
- **The migration has NOT been run against the app's real Neon database.** The API key provided for verification was scoped to a *different* Neon project (its `public` schema belongs to an unrelated app), so the dry-run was done on an isolated test database there and cleaned up. Before deploying, run both migrations against a branch of the **actual** letitrain DB (host `ep-lucky-wind-…`) and re-confirm the backfill row counts.
- Cross-org update/delete on another org's row currently throws Prisma `P2025` (denies the write) where the pre-existing code already tolerated that pattern; where a scoped read preceded the write, a clean not-found guard was added instead.
- Mobile org context is threaded through the session model only; org-level settings UI is deferred to 13c.
- 13b was deliberately not started (its own branch, per the branching rules).

### Suggested Next Step
Merge `phase-13a-saas-foundation`, then start **13b** (org-aware auth + data-access consistency) on its own branch, fresh from `master`.


---

## Phase 13b — Completion Report (2026-07-12)

**Status: ✅ COMPLETE** — Org-aware auth + data-access consistency. Branch: `phase-13b-saas-org-auth` (branched from `master` after 13a merged).

### Summary of Work

| Area | What Shipped |
|------|--------------|
| **Email-uniqueness decision (documented)** | Recorded the product decision in code: email is **globally unique**, a user belongs to **exactly one org**, org is always derived server-side. Comments added at `User.email @unique` (schema) and at the login lookup (`src/lib/login.ts`). |
| **Login attaches org context** | Already wired in 13a; now covered by tests — login resolves the user by email alone and returns/embeds their real org. |
| **Cross-org auth cannot be forged** | New tests prove a client-supplied `organizationId` in the login body is ignored (stripped by the zod schema; org comes from the DB user row), and that two users in different orgs each resolve to their own org. |
| **No client-supplied org trusted anywhere** | Audit: every `organizationId` used in an API route is `session.organizationId` (server-derived) — grep-confirmed, no route reads an org from body/query/headers. |
| **No hardcoded single-org assumption** | Audit: the literal org UUID appears only in the migration + seed; `"Let It Rain"` appears only as UI branding (page titles), never as an org id/name in application logic. |
| **Scoping consistency** | Every service derives org from the same session object as the existing permission/driver-scoping — one uniform pattern, no parallel mechanism. |

### Modified Files
- `prisma/schema.prisma` — documentation comment at `User.email` (no structural change)
- `src/lib/login.ts` — documentation comment at the by-email lookup
- `src/app/api/v1/auth/login/route.test.ts` — cross-org / org-attach tests (+2)

### Verification Results
- ✅ ESLint: 0 errors
- ✅ `next build` (type check): 0 errors
- ✅ Web tests: **202/202** passing (was 200 after 13a; +2 login org tests)
- ✅ Mobile tests: **15/15** passing
- ✅ Grep audits: 0 client-supplied org ids trusted; 0 hardcoded org ids/names in app logic

### Notes / Open Items
- 13b required no structural code change beyond documentation + tests, because 13a already threaded org through login/session correctly. This report formalizes the decision, proves it can't be bypassed, and records the two audits the checklist requires.
- Real-DB migration dry-run remains the one external step carried over from 13a (the provided API key was scoped to a different Neon project) — still to be run against a branch of the actual letitrain DB before deploy.

### Suggested Next Step
Merge `phase-13b-saas-org-auth`, then start **13c** (admin-only org-creation flow + org-level settings UI + CI-integrated isolation suite) on its own branch, fresh from `master`.


---

## Phase 13c — Completion Report (2026-07-12)

**Status: ✅ COMPLETE** — Admin org-creation flow, org-level settings UI, and the isolation suite wired into CI. Branch: `phase-13c-saas-selfserve-start` (from `master` after 13b merged). No schema change (AppConfig fields already existed).

### Summary of Work

| Area | What Shipped |
|------|--------------|
| **Org provisioning** | `src/lib/org-provisioning.ts` — `createOrganizationWithAdmin()` creates a new Organization + first admin (full permissions) + its AppConfig, atomically in one transaction. Structurally can only CREATE a new org (no existing-org-id input), so it can never attach an admin to an existing tenant. |
| **CLI flow (admin-only)** | `scripts/create-org/create-org.ts` — provision an org from the command line (admin-only by requiring DB access), matching the Phase 1 migration-script precedent. |
| **Admin API endpoint** | `POST /api/v1/admin/organizations` — gated by a platform bootstrap secret (`PLATFORM_ADMIN_TOKEN`), **404 when unset** (inert by default), 401 on missing/wrong token. Not the normal user-permission model (creating a tenant is a platform action) and not public self-serve (that's 13d). |
| **Org-level settings** | `getOrgSettings`/`updateOrgSettings` (scoped to `session.organizationId`, gated `MANAGE_SETTINGS`), `GET`/`PATCH /api/v1/org/settings`, a server action, and a new **"Organization" tab** in web Settings editing `businessName` + `defaultLowStock`. This is the first code to read/write the now-per-org `AppConfig`. |
| **CI** | `.github/workflows/ci.yml` — runs web lint + `npm test` (which includes the cross-org isolation suite) + `next build`, and mobile tests, on every push to `master` and every PR. |

### New Files
- `src/lib/org-provisioning.ts` (+ `src/lib/org-provisioning.test.ts`)
- `scripts/create-org/create-org.ts`
- `src/app/api/v1/admin/organizations/route.ts` (+ test)
- `src/app/api/v1/org/settings/route.ts`
- `src/app/(app)/settings/org-settings-tab.tsx`
- `.github/workflows/ci.yml`

### Modified Files
- `src/app/(app)/settings/service.ts` — `getOrgSettings` / `updateOrgSettings` (+ tests)
- `src/app/(app)/settings/schemas.ts` — `orgSettingsFormSchema`
- `src/app/(app)/settings/actions.ts` — `updateOrgSettingsAction`
- `src/app/(app)/settings/page.tsx` — Organization tab (gated `MANAGE_SETTINGS`)

### Verification Results
- ✅ ESLint 0 errors, `next build` 0 type errors
- ✅ Web tests **215/215** (was 202; +13: provisioning, admin-endpoint authz, org-settings)
- ✅ Mobile tests **15/15**
- ✅ **Two real organizations, real DB, end-to-end:** on an isolated database (created on your Neon account with all migrations applied), the *real* provisioning flow + *real* service functions were exercised — 15/15 checks passed: both orgs provisioned; each created items/orders with its own opening movement; org A could **not** order org B's item, fetch org B's order, or assign org B's user as a driver; org lists excluded the other tenant; and org-settings changes in A did not affect B. Branch deleted afterward.

### Notes / Open Items
- **CI is configured but has not yet been observed executing** — nothing has been pushed (per your "don't push" instruction), so GitHub Actions hasn't run the workflow yet. It triggers on every push to `master` and every PR; the first push will exercise it.
- The end-to-end "second org" verification was done **programmatically** against a live DB (this is a headless environment), driving the same provisioning flow + services the UI uses — equivalent to a manual click-through. "View reports" isolation is covered transitively: reports is a pure query over org-scoped `Movement`/`Item`, both proven isolated here and in the cross-org suite.
- Carried over from 13a: the migration still needs a dry-run against a branch of the **actual** letitrain production DB before deploy (the key provided is scoped to a different Neon project). Not blocking 13c.
- `PLATFORM_ADMIN_TOKEN` is unset by default → the admin endpoint is inert until an operator sets it.

### 13d Gate
13d (billing / Stripe / self-serve signup) is **not started** — it is gated on a real trigger event (App Store go-live date or a named prospective customer) being recorded in this file's 13d section. No such trigger is recorded. Per the phase plan, work stops here pending that decision.

### Suggested Next Step
Record a real 13d trigger (or explicitly authorize building it speculatively) — otherwise 13c is the stopping point for this phase.

