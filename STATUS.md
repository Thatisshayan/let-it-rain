# STATUS — Let It Rain

> Single-link snapshot for any incoming agent, session, or human. If you were only told "we're working on Let It Rain", start here.
>
> Last refreshed: 2026-07-17

## Current State

Let It Rain is a multi-tenant inventory and order-tracking product with:

- a Next.js 16 web app
- a shared `/api/v1` JSON API
- an Expo mobile app
- Prisma 7 on PostgreSQL

As of **Friday, July 17, 2026**, the codebase is functionally at **Phase 13 complete** and moving into:

- **Phase 14**: internal-team go-live
- **Phase 15**: hardening and cleanup
- **Phase 16**: first paying customer, explicitly deferred

Verified on 2026-07-17:

- web tests are green: `236/236`
- mobile tests are green: `84/84`
- password reset/change increments `tokenVersion`
- CSV formula-injection hardening is implemented
- mobile no longer relies on the legacy `MANAGE_ORDERS` permission in the updated order flows
- explicit web/mobile `typecheck` scripts exist, and CI runs them
- audit-covered user/session mutations and order lifecycle writes fail closed atomically
- web/mobile permission re-sweep completed; direct-route mobile permission gaps were closed
- Phase 13 historical docs are now explicitly marked as historical context, not active execution guidance

## Read Order

If you are new to the repo, read these in order:

1. `README.md`
2. `STATUS.md`
3. `LETITRAINNEXTSPRIN.md`
4. `RUNBOOK-INTERNAL-LAUNCH.md`
5. the relevant ADR or feature doc for the area you are changing

If you only read `README.md`, `STATUS.md`, and `LETITRAINNEXTSPRIN.md`, you should be able to work effectively.

## What Is Actually Done

These items were previously described as future work in some docs, but are already landed in code:

- `tokenVersion` bump on `changeOwnPassword` and `resetUserPassword`
- full 11-permission default in `prisma/schema.prisma`
- backfill migration for the newer permissions
- signup-token tests for unknown, consumed, expired, and valid tokens
- CSV formula-injection hardening
- mobile order-permission cleanup away from `MANAGE_ORDERS`
- explicit web/mobile `typecheck` scripts, with CI running both
- explicit audit-log failure semantics for audited mutations

## What Is Still Open

### Phase 15 — Hardening

- Expand mobile automated coverage beyond the current 20 files / 84 tests.
- Add Stripe webhook isolation and negative-path tests when billing work resumes.

### Phase 14 — Internal-Team Launch

- Set internal deploy configuration:
  - `PLATFORM_ADMIN_TOKEN`
  - internal `APP_URL`
  - fresh deploy `SESSION_SECRET`
  - Upstash envs if multi-instance rate limiting matters
- Rehearse migrations on a Neon branch before production.
- Run end-to-end manual smoke testing by role on web and mobile.
- Lock public signup appropriately for internal launch if that remains the launch policy.

### Phase 16 — Deferred

- live Stripe
- transactional email provider
- public signup
- public-domain app rollout
- first paying customer runbook execution

## Repo Rules

These are project rules, not suggestions:

### 1. Docs must be findable

Any agent told to work on Let It Rain must be able to discover the project state from:

- `README.md`
- `STATUS.md`
- `LETITRAINNEXTSPRIN.md`

Those files are load-bearing and must stay accurate.

### 2. No stale docs

If code changes behavior, the relevant docs are updated in the same change-set.

At minimum, keep these in sync when applicable:

- `README.md`
- `STATUS.md`
- `LETITRAINNEXTSPRIN.md`
- runbooks
- API docs
- ADRs

### 3. No fake completion

A task is only complete when:

- the implementation exists
- verification actually ran
- the docs reflect the verified state

If one of those is missing, the task is still open.

### 4. No silent skipping

If a task is blocked, risky, or only partially done, say so explicitly. Do not present partial work as closure.

### 5. Deletions require explicit approval

Do not delete files unless Shayan explicitly approves it.

## Canon

Use these as the current sources of truth:

- active roadmap: `LETITRAINNEXTSPRIN.md`
- current snapshot: `STATUS.md`
- internal launch operations: `RUNBOOK-INTERNAL-LAUNCH.md`
- paying-customer work: `RUNBOOK-FIRST-PAYING-CUSTOMER.md`
- historical decisions: `docs/adr/`

Historical audits and one-off planning documents are useful context, but they are not canon.
