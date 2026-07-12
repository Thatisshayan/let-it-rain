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
- [ ] `Organization` model exists in `prisma/schema.prisma` with at minimum `id`,
      `name`, `createdAt`.
- [ ] `organizationId` column added to: `User`, `Item`, `Order`, `OrderLineItem`
      (directly or via `Order` relation — decided and documented which), `AuditLog`,
      `AppConfig`.
- [ ] Explicit decision made and documented (code comment at the schema field) on
      whether `Movement` gets its own direct `organizationId` column (denormalized
      for query performance) vs. relying solely on its `Item`/`User` relations —
      not left ambiguous.
- [ ] `AppConfig` is no longer a hardcoded `id=1` global singleton — it is one row
      per organization (either `organizationId` as primary key, or a `@@unique`
      constraint enforcing one row per org).
- [ ] Every new `organizationId` column has an index (`@@index([organizationId])` or
      equivalent) — unscoped-organization queries at scale are the whole point of
      this schema change; they must be fast.

### Migration
- [ ] Migration adds new `organizationId` columns as **nullable** first.
- [ ] A single `Organization` row is created representing the current tenant
      ("Let It Rain").
- [ ] All pre-existing rows across every affected table are backfilled to that org's
      id, with zero data loss (verified by row-count comparison before/after).
- [ ] A follow-up migration changes the columns to `NOT NULL` only after backfill is
      confirmed complete.
- [ ] Migration has been run and verified against a **local copy** of the database
      before being proposed for the real Neon database — not run directly against
      production without that dry run.
- [ ] Migration is idempotent or clearly documented as one-time-only (matching the
      precedent set by Phase 1's `scripts/permissions-migration/migrate.ts`).

### Session / auth
- [ ] `SessionPayload` (`src/lib/auth.ts`) includes `organizationId`.
- [ ] `resolveCurrentSession()` re-fetches and re-validates `organizationId` from the
      DB on every request (same freshness guarantee already given to
      `active`/`tokenVersion`) — not just embedded once in the JWT and trusted for
      30 days.
- [ ] Both `getSession()` (web, cookie-based) and `verifyBearerToken()` (mobile,
      Bearer-token-based) correctly carry the new field — verified by an
      updated/new auth test for each path.

### Query scoping (the exhaustive pass)
- [ ] Every function in `src/app/(app)/items/service.ts` that reads or writes `Item`
      or `Movement` rows includes `organizationId` in its Prisma `where`/data —
      confirmed function-by-function, not spot-checked.
- [ ] Same exhaustive confirmation for `src/app/(app)/orders/service.ts` (`Order`,
      `OrderLineItem`).
- [ ] Same exhaustive confirmation for `src/app/(app)/settings/service.ts`.
- [ ] Same exhaustive confirmation for `src/app/(app)/accounts/service.ts`.
- [ ] Same exhaustive confirmation for `src/app/(app)/audit-log/service.ts`.
- [ ] Every route under `src/app/api/v1/*/route.ts` confirmed to call only through
      the (now org-scoped) service layer — no route found querying Prisma directly
      and bypassing the service layer's scoping. If any such route is found, it is
      fixed as part of this checklist, not deferred.
- [ ] Any web server component that queries Prisma directly (not through
      `service.ts`, e.g. dashboard page data-fetching) is confirmed org-scoped too —
      the service-layer sweep above does not cover these by itself; they must be
      checked separately.

### Cross-org isolation test suite (the load-bearing verification for this whole phase)
- [ ] An automated test suite exists that creates **two** `Organization` rows, seeds
      each with its own users/items/orders/movements/audit-log entries.
- [ ] Test asserts a session scoped to Org A cannot retrieve Org B's items via any
      service function or API route (list, get-by-id, search/filter variants all
      covered, not just the happy-path list endpoint).
- [ ] Same assertion for orders (including order detail, driver-assigned orders).
- [ ] Same assertion for movements/activity.
- [ ] Same assertion for audit log entries.
- [ ] Same assertion for user list/detail (Org A admin cannot see/manage Org B's
      users).
- [ ] Same assertion for `AppConfig` (Org A cannot read/write Org B's settings).
- [ ] Test suite runs as part of the normal test command (`npm test` at repo root)
      — not a separate manual script that could silently stop being run.

### Regression check
- [ ] Full existing web test suite passes (baseline going into this phase: 164/164
      per Phase 1's completion report — confirm current count and match/exceed it).
- [ ] Full existing mobile test suite passes (baseline: 15/15 per Phase 11's
      completion report).
- [ ] `eslint` passes with 0 errors.
- [ ] `tsc` / `next build` passes with 0 errors.
- [ ] `npx prisma generate` completes cleanly after the schema change.

---

## 13b — Core necessities (org-aware auth + data-access consistency)

- [ ] Explicit decision recorded (code comment + this file) on email uniqueness
      model: confirmed as "globally unique email, one org per user" per `PHASE13.md`
      §4's default recommendation, **or** a documented, deliberate deviation with
      reasoning if changed.
- [ ] `POST /api/v1/auth/login` (`src/lib/login.ts` +
      `src/app/api/v1/auth/login/route.ts`) resolves and attaches correct org
      context on successful login — verified by test.
- [ ] Verified by test: a user cannot authenticate into a different org's context
      under any input (e.g. malformed/forged org hints, if any org selector exists
      client-side — there should not be a client-supplied org id trusted anywhere;
      org must always be derived server-side from the authenticated user).
- [ ] Every service-layer function's scoping approach (org + existing
      permission/driver-scoping) is internally consistent — same pattern, not one
      file doing it differently from another.
- [ ] No hardcoded assumption of a single org remains anywhere in the codebase
      (grep for the literal string used for the original "Let It Rain" org's id/name
      outside of the migration/seed script itself — it should not appear in
      application logic).

---

## 13c — Broader necessities + start of self-serve

- [ ] An org-creation flow exists (admin-only/invite-based is sufficient — does not
      need to be public yet) that creates a new `Organization` row plus its first
      admin `User`, fully functional end-to-end.
- [ ] A second real organization has been created via this flow (not just via a
      test/seed script) and manually verified to work: login, create an item,
      create an order, assign a driver, view reports — all succeed and are
      correctly isolated from the first org.
- [ ] Org-level settings (business name, default low-stock threshold — the
      `AppConfig` fields) are editable per-org through actual UI, not just the
      database.
- [ ] The cross-org isolation test suite from 13a is now integrated into CI (not
      just runnable locally) and confirmed actually running on every PR/push, not
      just present in the repo.
- [ ] Test suite extended, if needed, to cover any new surfaces introduced by the
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
