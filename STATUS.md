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

- web tests are green: `237/237`
- mobile tests are green: `110/110`
- root web/API `typecheck` passes (`next typegen && tsc --noEmit`)
- mobile `typecheck` passes (`tsc --noEmit`)
- password reset/change increments `tokenVersion`
- CSV formula-injection hardening is implemented
- mobile no longer relies on the legacy `MANAGE_ORDERS` permission in the updated order flows
- explicit web/mobile `typecheck` scripts exist, and CI runs them
- audit-covered user/session mutations and order lifecycle writes fail closed atomically
- web/mobile permission re-sweep completed; direct-route mobile permission gaps were closed
- Phase 13 historical docs are now explicitly marked as historical context, not active execution guidance
- current GitHub Actions CI is green for commit `24496d7` (run `29614610882`)

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

- Expand mobile automated coverage beyond the current 27 files / 110 tests.
- Add Stripe webhook isolation and negative-path tests when billing work resumes.

### Phase 14 — Internal-Team Launch

- Set internal deploy configuration:
  - production deploy is now configured on Vercel at `https://let-it-rain-ten.vercel.app`
  - `PLATFORM_ADMIN_TOKEN`, `APP_URL`, `SESSION_SECRET`, and Upstash REST envs were set on 2026-07-17
  - public signup is intentionally enabled in production via `PUBLIC_SIGNUP_ENABLED=true`
- Fresh Neon production backend was created on 2026-07-17, migrated, seeded, and wired to Vercel:
  - Neon project id: `square-shadow-17526702`
  - production login against the seeded admin was verified live
- Rehearse migrations on a Neon branch before future production schema changes.
- Run the remaining UI/device-level manual smoke testing on web and mobile.
- Live protected web-route smoke now passed on 2026-07-17 for `/`, `/items`, `/orders`, `/reports`, `/settings`, and `/activity` against production using an authenticated session.
- Internal-launch-safe signup posture is repo-backed and now explicitly configured:
  - production public signup is enabled intentionally for this deploy
  - `PLATFORM_ADMIN_TOKEN` gates the separate admin org-provisioning path
  - live checks verified `/login` returns `200`, `/api/v1/admin/organizations` returns `401` without the token and `200` with it, and `POST /api/v1/signup` returns `201`
  - production API smoke also verified admin login, limited-user permission denial on reports, item create/list/detail, order create/list, org/org-settings reads, and reports reads
  - live protected web-route smoke also verified `200` responses for `/`, `/items`, `/orders`, `/reports`, `/settings`, and `/activity`

### Phase 16 — Deferred

- live Stripe
- transactional email provider
- external paid-customer launch (self-service signup is intentionally enabled for the internal deployment)
- public-domain paid rollout
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
