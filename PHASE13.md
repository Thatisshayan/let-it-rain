# Phase 13 — Multi-Tenant SaaS Foundation: Full Agent Handoff

**Audience:** this document is written for an autonomous coding agent picking this up
with zero prior context on this conversation. Read this file top to bottom before
touching code. Do not re-derive architecture decisions already made here — follow them,
and only deviate if you find a concrete correctness problem, in which case stop and
flag it rather than silently going a different direction.

**Do not start this work on `master`.** Each sub-phase (13a, 13b, 13c, 13d) gets its
**own branch**, branched from `master` (or from the previous sub-phase's branch after
it has merged — not from an unmerged in-progress branch), e.g.:
- `phase-13a-saas-foundation`
- `phase-13b-saas-org-auth`
- `phase-13c-saas-selfserve-start`
- `phase-13d-saas-billing`

Do not combine multiple sub-phases into one branch, even if it feels efficient — each
sub-phase has its own acceptance criteria (see `PHASE13ACCEPTANCELIST.md`) and must be
reviewable and mergeable independently. This phase touches nearly every query in the
codebase; each sub-phase must land as a coherent, independently-verifiable diff, not
mixed into unrelated commits or bundled with the next sub-phase's work.

**Full checklist lives in a separate file:** `PHASE13ACCEPTANCELIST.md` (repo root) is
the authoritative, checkable acceptance-criteria list for every sub-phase. This
document (`PHASE13.md`) is the narrative spec/context; that file is what you actually
check off. Do not consider a sub-phase done based on this document's prose
"acceptance criteria" summaries alone — the full checklist in
`PHASE13ACCEPTANCELIST.md` governs.

### Branching & completion reporting

For every sub-phase, before merging its branch to `master`:
1. Every box in that sub-phase's section of `PHASE13ACCEPTANCELIST.md` is checked and
   actually verified true (tests run and passing, not assumed).
2. A dated "Completion Report" section — same format as Phase 0/1/11's reports
   already in `LETITRAINNEXTSPRIN.md` (summary table, new/modified files,
   verification results, notes/open items) — is appended to **all three** of:
   - `PHASE13.md` (this file)
   - `LETITRAINNEXTSPRIN.md`
   - `PHASE13ACCEPTANCELIST.md`
3. Only then does the branch get merged, and only then does the next sub-phase's
   branch get started.

---

## 1. Why this exists (read this before writing code)

`letitrain` is currently a **single-tenant** inventory/order management app (Next.js
web + Expo/React Native mobile, one shared Postgres/Neon DB via Prisma). One business
("Let It Rain") uses it. There is a real near-term possibility of:

- Going live on the App Store as a product other businesses could adopt, and/or
- Selling access to a second business directly.

Neither of those situations tolerates "wait a couple weeks while we retrofit
multi-tenancy" — by the time someone wants in, the foundation needs to already exist.
At the same time, building a **full SaaS product** (self-serve signup, billing, tiers,
support tooling) before there is an actual second customer is premature — that work is
deliberately deferred to sub-phase 13d, gated on a real trigger event, not built
speculatively now.

**The core problem today:** grep the schema (`prisma/schema.prisma`) and you will find
zero tenant/org concept. Every model — `User`, `Item`, `Movement`, `Order`,
`OrderLineItem`, `AuditLog`, `AppConfig` — implicitly assumes one business owns all
rows in the table. Every query in every `service.ts` file, every API route under
`src/app/api/v1/*/route.ts`, and every mobile screen that fetches data does so with
**no tenant filter at all**, because there is no column to filter on. This is fine
today because there is exactly one tenant. It becomes an active security bug the
moment a second organization's data lands in the same tables — the failure mode is
"Company A sees Company B's inventory/orders/revenue," which is categorically worse
than the Phase 0 findings (those were wrong-role-sees-data-within-one-company; this
would be wrong-company-sees-data-at-all).

This phase is explicitly **not** "build a SaaS platform." It is: make the data model
and every query path aware of tenant boundaries, prove that boundary can't be crossed,
and stop there until there's a real second customer.

---

## 2. Relevant prior work (context, already shipped, do not redo)

These are already complete on `master` as of this handoff — read them, don't rebuild
them:

- **Phase 0** — fixed 5 read-side permission-gate bugs (page/screen level checks
  missing despite correct API-layer and service-layer protection). Established the
  pattern: **the service layer is the source of truth for data access**, page/screen
  UI checks are a secondary fast-path, not the real guard. Phase 13 must follow the
  same pattern: tenant scoping belongs in the service layer (and ultimately the
  Prisma query itself), not just at the UI.
- **Phase 1** — added `AuditLog`, `User.tokenVersion` (session revocation), split
  `MANAGE_ORDERS` into `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS`, added
  `VIEW_REPORTS`/`VIEW_COSTS`/`VIEW_AUDIT_LOG`/`MANAGE_SETTINGS`, added `AppConfig`
  singleton (currently `id=1`, hardcoded single-row — **this singleton assumption is
  exactly the kind of thing Phase 13 needs to break**, see §5).
- **Phase 2** — Orders & Deliveries, shipped, in TestFlight.
- **Phase 11** — mobile test suite, Sentry, staging EAS profile, nightly backups,
  accessibility pass. The **staging environment pattern** (`eas.json`'s `staging`
  profile, `EXPO_PUBLIC_APP_ENVIRONMENT`) is a useful reference for how environment
  separation is already done in this codebase — Phase 13 is tenant separation
  *within* one environment, not another environment.

Full detail on all of the above: `LETITRAINNEXTSPRIN.md` (repo root) — read its Phase
0/1/11 "Completion Report" sections if you need file-level specifics on what already
shipped.

---

## 3. Current architecture facts (verified, as of this handoff)

**Stack:** Next.js App Router (web, `src/app/`) + Expo Router (mobile, `mobile/app/`),
one shared Postgres (Neon) via Prisma, `/api/v1` JSON API is the bridge both web and
mobile call through. Web also has server components that call `service.ts` functions
directly (no HTTP round-trip) for some pages — **both paths need tenant scoping**, not
just the API routes.

**Auth model** (`src/lib/auth.ts`, 93 lines, read in full before editing):
- JWT-based session (`jose` library), `SessionPayload = { userId, email, name,
  permissions, tokenVersion }`.
- `resolveCurrentSession()` **re-fetches the user from the DB on every request** (not
  trusting the JWT's embedded permissions) — checks `active` and `tokenVersion`. This
  is the natural place to also attach `organizationId` to the session, so it's always
  fresh even if the user is ever moved between orgs (unlikely, but the pattern is
  already there).
- `verifyBearerToken()` — mobile's auth path (Bearer token in `Authorization` header).
- `getSession()` — web's auth path (httpOnly cookie).
- Both funnel through the same `resolveCurrentSession()`.

**Permissions model** (`src/lib/permissions.ts`, 43 lines): flat array of permission
strings on `User.permissions`, checked via `hasPermission(session, PERMISSION)`. This
is **user-level**, not org-level — it stays that way in Phase 13 (permissions describe
what a user can do *within their org*; org membership is a separate, new concept).

**Service layer files** (the actual data-access boundary — this is where tenant
scoping must be enforced, per the Phase 0 lesson that route-level checks alone are not
sufficient):
- `src/app/(app)/items/service.ts`
- `src/app/(app)/orders/service.ts`
- `src/app/(app)/settings/service.ts`
- `src/app/(app)/accounts/service.ts`
- `src/app/(app)/audit-log/service.ts`

**API routes:** `src/app/api/v1/*/route.ts` — 22+ routes as of Phase 0's audit, all
wrapped in `withAuth`/`withPermission`. These call into the service layer above; they
do not talk to Prisma directly (confirm this still holds before assuming it — if any
route bypasses the service layer and queries Prisma inline, it needs the same fix).

**Mobile:** `mobile/app/` (Expo Router screens) + `mobile/src/api/*.ts` (HTTP client
wrappers calling the same `/api/v1` routes). No separate tenant-scoping work needed on
mobile beyond passing through whatever the API returns — the API is the enforcement
boundary, mobile is a client of it.

---

## 4. What "done" looks like for each sub-phase

### 13a — Foundation (schema + query scoping)

**This is the expensive, hard-to-retrofit-later part. Do this first, and do it
thoroughly — the whole point of doing Phase 13 "early" is that this sub-phase is cheap
now (one tenant's data) and gets exponentially more painful once there's real
multi-tenant data to migrate around.**

1. **New `Organization` model** in `prisma/schema.prisma`:
   ```prisma
   model Organization {
     id        String   @id @default(uuid())
     name      String
     createdAt DateTime @default(now())

     users     User[]
     items     Item[]
     orders    Order[]
     auditLogs AuditLog[]
     appConfig AppConfig?
   }
   ```
   (Exact field list can grow — e.g. a `slug` for future subdomain routing — but don't
   add speculative fields not needed by 13a/13b; add them in 13c/13d if/when actually
   needed.)

2. **Add `organizationId` to every tenant-scoped table**: `User`, `Item`, `Movement`
   (via its `Item`/`User` relations — decide whether `Movement` needs its own
   `organizationId` column directly for query efficiency, or whether joining through
   `Item`/`User` is acceptable; given `Movement` is queried heavily for
   activity/reports, a direct denormalized `organizationId` column with its own index
   is almost certainly worth the redundancy), `Order`, `OrderLineItem` (via `Order`),
   `AuditLog`, `AppConfig` (this singleton becomes **one row per org**, not one row
   globally — `id` can no longer be hardcoded to `1`; use org-scoped lookup or make
   `organizationId` the effective key with a `@@unique` or make it the primary key
   directly).

3. **Migration for existing data**: write a Prisma migration that (a) adds the new
   columns as nullable first, (b) creates one `Organization` row representing the
   current single tenant ("Let It Rain"), (c) backfills every existing row's
   `organizationId` to that org's id, (d) then alters the columns to `NOT NULL` in a
   follow-up migration once backfill is confirmed. Follow the same
   "nullable-then-backfill-then-required" pattern Phase 1 already used successfully
   for its own migration (see `prisma/migrations/20260712150000_phase1_permissions_audit/`
   for the precedent) — **test this migration against a local copy of the DB first**,
   same standing rule Phase 1's plan already established for risky migrations.

4. **Session carries org context**: extend `SessionPayload` in `src/lib/auth.ts` to
   include `organizationId`. `resolveCurrentSession()` already re-fetches from the DB
   every request — extend its `select` to include `organizationId` and thread it
   through. This means org membership changes take effect immediately, same guarantee
   the existing `active`/`tokenVersion` checks already provide.

5. **Every service-layer query gets an org filter.** This is the bulk of the work and
   the part most likely to have a missed spot — treat it exactly like Phase 0's audit:
   go through `items/service.ts`, `orders/service.ts`, `settings/service.ts`,
   `accounts/service.ts`, `audit-log/service.ts` function by function, and confirm
   every `prisma.<model>.findMany/findUnique/create/update/delete` call includes
   `organizationId: session.organizationId` in its `where` (for reads) or its data (for
   writes). Do not rely on "I added it to the obvious ones" — this needs the same
   systematic, exhaustive pass Phase 0 did, because a single missed query is a
   cross-tenant data leak, not a cosmetic bug.

6. **Acceptance criteria for 13a:**
   - Schema migration applies cleanly to a local DB copy with existing data intact.
   - Every existing row is backfilled to the single "Let It Rain" org with no data
     loss.
   - Session payload includes `organizationId`; verified by a new/updated auth test.
   - A new integration test suite exists that creates **two organizations**, seeds
     each with data, and asserts that a session for Org A can *never* retrieve Org B's
     items/orders/movements/audit logs/users through any service function or API
     route — this is the multi-tenant equivalent of Phase 0's audit and is the single
     most important test in this entire phase.
   - Full existing test suite (web + mobile) still passes with zero regressions.

### 13b — Core necessities (org-aware auth + data access layer)

Builds directly on 13a's schema. Scope:

- **Login resolves org membership.** `POST /api/v1/auth/login` (see
  `src/app/api/v1/auth/login/route.ts` and `src/lib/login.ts`) currently looks up a
  user by email globally. Decide and implement: is email unique per-org, or globally
  unique across the whole product? Given `User.email` currently has a global
  `@unique` constraint in the schema, the simplest correct choice consistent with
  today's schema is **email stays globally unique, and a user belongs to exactly one
  org** (no multi-org membership in this phase — that's a 13c/later concern if ever
  needed). Document this decision in code comments at the point of the constraint,
  since it's a real product decision, not just an implementation detail.
- **Every existing service function signature reviewed**: functions like
  `listOrders(session, ...)` already take the session and derive scoping from it
  (e.g. driver-scoping from Phase 0) — extend that existing pattern to also derive
  `organizationId` from the same session object, rather than inventing a parallel
  scoping mechanism. Consistency with the existing driver-scoping pattern in
  `orders/service.ts` matters more than any specific implementation detail here.
- **Credential/environment separation per org** where it matters — e.g. if/when push
  notification tokens (Phase 6, not yet built) or Sentry contexts need to distinguish
  which org an event belongs to, that plumbing should exist by the time those features
  land. Don't build push infra now; just don't paint yourself into a corner where
  adding `organizationId` to those later is hard.

**Acceptance criteria for 13b:**
- Login correctly resolves and attaches org context; a user from Org A cannot
  authenticate into Org B's context under any circumstance.
- Service-layer signatures are consistent (session-derived org scoping, matching the
  existing session-derived permission/driver-scoping pattern already in the codebase).

### 13c — Broader necessities + start of self-serve

- **Org creation flow** — does not need to be public/self-serve yet; an
  admin-only/invite-based "create a new organization + its first admin user" flow is
  sufficient for this sub-phase. This unblocks actually testing with a second real
  org without needing 13d's full signup UX.
- **Org-level settings**, separate from the existing per-user `settings/account-tab.tsx`
  — e.g. `AppConfig`'s `businessName`/`defaultLowStock` naturally become org-scoped
  settings (this is exactly why 13a's `AppConfig` schema change matters).
- **Cross-org safety test suite** — if 13a's acceptance criteria only got a minimal
  version of this, this is where it gets built out properly and kept running in CI
  going forward, not just as a one-time verification.

**Acceptance criteria for 13c:**
- A second organization can be created and used end-to-end (login, create items,
  create orders, view reports) with zero data crossover with the first org, verified
  by the automated cross-org test suite running in CI.

### 13d — Sell-ready (deferred, gated on a real trigger)

**Do not start this sub-phase speculatively.** It is scoped here so the plan exists,
not so it gets built now. Start it only when one of these becomes true: (a) App Store
go-live is actually imminent and needs a real signup path, or (b) a specific paying
customer is lined up and needs onboarding.

- Pricing tiers (data model + enforcement — e.g. seat limits, feature gating by tier).
- Stripe billing integration (subscription creation, webhook handling for
  payment/cancellation events, dunning).
- Self-serve signup flow (public org creation, email verification, initial admin
  account setup) — builds on 13c's admin-created-org flow but makes it public.
- Customer support tooling (at minimum: a way for you to see which orgs exist, their
  plan, and basic usage — doesn't need to be fancy).

No further detail is scoped here deliberately — by the time this sub-phase starts, the
actual trigger event (App Store terms, or a specific customer's requirements) will
shape the real requirements more usefully than speculation would now.

---

## 5. Explicit non-goals for this phase

Do not build these as part of Phase 13, even if they seem related — they're separately
scoped elsewhere in `LETITRAINNEXTSPRIN.md` and pulling them in here just bloats scope:

- **Multi-location within one org** (Phase 10 in the roadmap) — a different axis of
  scoping (one business, many warehouses) than multi-tenancy (many businesses). Don't
  conflate the two; `organizationId` and a future `locationId` are independent
  dimensions.
- **White-label / custom branding per org** — cosmetic, not foundational; skip.
- **Public API / integrations / webhooks** — unrelated to tenant isolation; skip.
- **Role/permission model changes beyond what's needed for org context** — Phase 1's
  permission set stays as-is; this phase adds org *membership*, not new permission
  types.

---

## 6. Verification requirements (apply at the end of every sub-phase, not just 13a)

Follow the same discipline already established by Phase 0/1/2/11 in this codebase:
- `prisma migrate dev` (or equivalent) applies cleanly; run against a **local copy**
  of the DB first for any migration touching existing data, never directly against
  the real Neon database without that dry run.
- Full lint (`eslint`), typecheck (`tsc`), and test suite (web `vitest` + mobile
  `vitest`/jest) all pass with zero regressions before considering a sub-phase done.
- The cross-org data-isolation test suite (§4, 13a) must exist and pass before 13a is
  considered complete — this is the load-bearing verification for this entire phase,
  more important than any other single test.
- Do not run any migration or seed script against the production database without
  explicit confirmation from the human owner of this project first — same standing
  rule already documented in `LETITRAINNEXTSPRIN.md`'s Phase 1 section for its own
  migration script.

---

## 7. Suggested execution order

1. `13a` on its own branch (`phase-13a-saas-foundation`): schema, migration, session,
   exhaustive query-scoping pass, cross-org test suite. Check every box in
   `PHASE13ACCEPTANCELIST.md`'s 13a section, write the three completion reports (§6
   above), merge.
2. `13b` on its own branch, started fresh from `master` after 13a merges. Same
   check-report-merge discipline.
3. `13c` on its own branch, same discipline.
4. **Stop.** Do not start `13d`'s branch without checking back in — it's gated on a
   real trigger event (recorded in `PHASE13ACCEPTANCELIST.md`'s 13d section), not on
   13c simply being finished.

---

## 8. A note on working style, since this may be picked up by an unfamiliar agent

This codebase's existing phases (0, 1, 2, 11) were all built with a specific
discipline worth matching: read the actual code before making claims about it, verify
findings against real files/grep rather than assuming, commit each verified chunk
separately with a clear message, and write a completion report (see
`LETITRAINNEXTSPRIN.md`'s "Phase 1 — Completion Report" section as the template) at
the end summarizing what shipped, what files changed, and what was explicitly
deferred. Follow that same pattern here — write that completion report **three
times** (once each into `PHASE13.md`, `LETITRAINNEXTSPRIN.md`, and
`PHASE13ACCEPTANCELIST.md`, per §"Branching & completion reporting" above) for every
sub-phase, rather than only reporting back informally.

If you are picking this up as a fresh agent with no prior context on this repo, also
read `PHASE13_INIT.md` (repo root) first — it's a condensed technical onboarding doc
written specifically to get you productive on this codebase without needing to
re-explore it from scratch.

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


---

## Phase 13d — Completion Report (2026-07-12)

**Status: ✅ COMPLETE (code)** — Sell-ready: pricing tiers + seat enforcement, Stripe billing, public self-serve signup with email verification, customer-support visibility, and mobile parity. Branch: `phase-13d-saas-billing` (from `master` after 13c merged).

**Trigger:** named prospective customer — **Organization "LETTHESANDSHINE" requested to purchase** (recorded in the 13d gate section of `PHASE13ACCEPTANCELIST.md`).

### Summary of Work

| Area | What Shipped |
|------|--------------|
| **Schema + migration** | `Organization` gains `plan` (FREE/PRO/ENTERPRISE), `subscriptionStatus`, `stripeCustomerId`/`stripeSubscriptionId` (unique), `currentPeriodEnd`, `emailVerified`; new `EmailVerificationToken` model. Additive migration with safe defaults; every pre-existing org **grandfathered to ENTERPRISE** (unlimited seats) so tiers never retroactively lock anyone out. Verified on a live DB copy. |
| **Pricing tiers + seat limits** | `src/lib/plans.ts` (seat limits FREE=3 / PRO=25 / ENTERPRISE=∞, feature map). `createUser` enforces the org's seat limit (active users only), org-scoped. |
| **Stripe billing** | `src/lib/stripe.ts` (lazy client, plan↔price mapping), `src/lib/billing.ts` (`createCheckoutSession` + a pure, unit-tested `handleStripeEvent`). `POST /api/v1/billing/checkout` (MANAGE_SETTINGS) and `POST /api/v1/billing/webhook` (signature-verified over the raw body). Handles checkout completion, subscription created/updated/deleted, invoice paid/failed (**dunning → PAST_DUE**). |
| **Self-serve signup + verification** | `src/lib/signup.ts` (`signUpOrganization` builds on 13c provisioning but starts the org **unverified** and issues a single-use, SHA-256-hashed token; `verifyEmailToken`). `POST /api/v1/signup` (public, **IP rate-limited**) and `POST /api/v1/auth/verify-email`. Email delivery is a provider-agnostic seam (`src/lib/email.ts`). |
| **Support visibility** | `GET /api/v1/admin/organizations` (platform-admin token) lists every org with plan, subscription status, and usage counts (users/items/orders). |
| **Mobile** | `GET /api/v1/org` (plan/subscription/usage). Mobile API client gains org-settings + plan + checkout calls; new **Organization & plan** screen (view plan/seats, edit business name + low-stock, "Upgrade to Pro" → opens Stripe Checkout), gated by MANAGE_SETTINGS. |

### New Files
- `prisma/migrations/20260712170000_phase13d_billing_plan/migration.sql`
- `src/lib/plans.ts` (+ test), `src/lib/stripe.ts`, `src/lib/billing.ts` (+ test), `src/lib/signup.ts` (+ test), `src/lib/email.ts`
- `src/app/api/v1/billing/checkout/route.ts`, `src/app/api/v1/billing/webhook/route.ts` (+ test)
- `src/app/api/v1/signup/route.ts` (+ test), `src/app/api/v1/auth/verify-email/route.ts`
- `src/app/api/v1/org/route.ts`
- `mobile/app/settings/organization.tsx`, `mobile/src/api/settings.test.ts`

### Modified Files
- `prisma/schema.prisma`, `prisma/seed.ts`
- `src/app/(app)/settings/service.ts` (seat-limit enforcement) + tests
- `src/lib/org-provisioning.ts` (emailVerified option) + test
- `src/app/api/v1/admin/organizations/route.ts` (GET support view) + test
- `src/app/api/v1/users/route.test.ts`, `src/app/(app)/cross-org-isolation.test.ts` (org plan in fixtures)
- `mobile/src/api/settings.ts`, `mobile/app/(tabs)/settings.tsx`

### Verification Results
- ✅ ESLint 0 errors, `next build` 0 type errors, mobile `tsc --noEmit` 0 errors
- ✅ Web tests **251/251** (was 215; +36 for plans, seat limits, billing/webhook, signup/verify, support view)
- ✅ Mobile tests **19/19** (was 15; +4 org/plan API client)
- ✅ **Migration verified on a live DB copy**: applied through 13c, inserted pre-13d orgs, applied the 13d migration — both orgs grandfathered to ENTERPRISE, `emailVerified=true`, `subscriptionStatus=NONE`, all six new columns present, `EmailVerificationToken` table created. Branch deleted afterward.

### Notes / Open Items — external wiring required before go-live
These are the "needs your real credentials" steps (analogous to the real-DB migration), all cleanly seam'd so only config/one function changes:
- **Stripe keys**: set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`. Until set, billing endpoints return 503 (inert). Run Stripe **test-mode** end-to-end (checkout + webhook via Stripe CLI) before enabling live.
- **Email provider**: `src/lib/email.ts` currently logs instead of sending; wire Resend/SES (set `EMAIL_PROVIDER_API_KEY`) so verification emails actually deliver. Until then, signup returns the token only in non-production.
- **Platform admin**: set `PLATFORM_ADMIN_TOKEN` to enable org creation + the support view (both 404 while unset).
- **`APP_URL`**: set so checkout success/cancel + verification links point at the real domain.
- **Email-verification enforcement**: the flow issues + consumes tokens and flips `emailVerified`, but login is **not** hard-gated on it (kept non-breaking). Decide whether to block unverified orgs from specific actions.
- Carried over from 13a: the migrations still need a dry-run against a branch of the **actual** letitrain production DB (the verification key was scoped to a different Neon project).

### Suggested Next Step
Wire the Stripe test-mode keys + email provider, onboard LETTHESANDSHINE via the admin org-creation flow (or public signup), and run the Stripe test-mode checkout/webhook loop end-to-end. Phase 13 (a–d) is otherwise complete.

