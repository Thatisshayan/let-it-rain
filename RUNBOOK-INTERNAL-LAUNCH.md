# Runbook — Internal Launch

Last updated: 2026-07-17

This runbook is for the **internal-team launch** phase only.

It is intentionally operational, not aspirational:

- use it to execute the remaining Phase 14 launch work
- do not mark any step complete unless it was actually performed
- if reality differs from this file, update this file in the same change-set

For current verified repo state, read:

1. `README.md`
2. `STATUS.md`
3. `LETITRAINNEXTSPRIN.md`

## Launch Scope

This launch is for:

- internal-team use only
- not public beta
- not first paying customers

Deferred out of this runbook:

- live Stripe rollout
- transactional email provider
- public signup/public domain launch
- first paying customer operations

## Preconditions

Before using this runbook:

- web tests should be green
- mobile tests should be green
- web/mobile typecheck should be green
- schema/migrations should already be committed and reviewed

As of 2026-07-17, the verified baseline is:

- web tests: `237/237`
- mobile tests: `110/110`

## Internal Deploy Configuration

These items are still operationally open until explicitly completed in the target environment:

1. Verify the already-set `PLATFORM_ADMIN_TOKEN`.
2. Verify the production `APP_URL`.
3. Verify the rotated `SESSION_SECRET`.
4. Verify Upstash rate limiting stays healthy under the actual deployment shape.
5. Smoke the live public-signup posture via `PUBLIC_SIGNUP_ENABLED=true`.

Record the exact deployed values outside git if they are sensitive. This repo should only
record that the step was performed, not the secret values themselves.

Applied production setting on 2026-07-17:

- `APP_URL=https://let-it-rain-ten.vercel.app`
- `PUBLIC_SIGNUP_ENABLED=true`
- `PLATFORM_ADMIN_TOKEN` is set in Vercel production envs
- `SESSION_SECRET` was rotated in Vercel production envs
- Upstash Redis REST URL/token are set in Vercel production envs

Example non-secret checklist:

```text
APP_URL=https://let-it-rain-ten.vercel.app
PUBLIC_SIGNUP_ENABLED=true
PLATFORM_ADMIN_TOKEN=set in deploy platform secret store
SESSION_SECRET=rotated in deploy platform secret store
UPSTASH_REDIS_REST_URL/TOKEN=set in deploy platform secret store
```

## Migration Rehearsal

Run this before touching the production database:

1. Create or choose a Neon branch for rehearsal.
2. Point the app and Prisma migration flow at that branch.
3. Run the exact migration path intended for production.
4. Verify row counts and organization/permission expectations.
5. Verify the app still boots and authenticates against the rehearsed database.
6. Only after a clean rehearsal, run the same migration path against production.

Suggested command flow from a clean local checkout:

```bash
cp .env.example .env.local
```

Update `.env.local` so `DATABASE_URL` and `DIRECT_URL` point at the Neon rehearsal
branch, then run:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm test
npm run typecheck
npm --prefix mobile test
npm --prefix mobile run typecheck
```

If the rehearsal branch needs seed data for manual auth/smoke checks:

```bash
npm run seed
```

Verification queries should be run either in Neon SQL editor or via your normal SQL
client against the rehearsal branch. At minimum confirm:

```sql
select count(*) as organizations from "Organization";
select count(*) as users from "User";
select count(*) as items from "Item";
select count(*) as orders from "Order";
select count(*) as audit_logs from "AuditLog";
```

Permission/backfill spot checks:

```sql
select email, permissions, "tokenVersion", active
from "User"
order by "createdAt" asc
limit 20;

select name, "emailVerified", plan, "subscriptionStatus"
from "Organization"
order by "createdAt" asc
limit 20;
```

Minimum checks after rehearsal:

- users still authenticate
- permissions still resolve as expected
- item/order/activity/report reads still work
- no unexpected null/backfill drift appears in key tables

## Launch Access Policy

Before internal launch, explicitly choose one of these:

1. Public signup remains enabled temporarily.
2. Public signup is gated behind admin-controlled flow for the internal period.

As of 2026-07-17, the repo-backed behavior is:

- production public signup is enabled intentionally on the live Vercel deploy
- the separate admin org bootstrap endpoint remains gated by `PLATFORM_ADMIN_TOKEN`

This was an explicit deploy-time choice and should remain visible until manual smoke
proves the path is acceptable.

## Manual Smoke Pass

Run this against the actual internal launch environment, not just local dev.

### Web

1. Sign in as an internal admin.
2. Confirm item browse, create/edit, and stock adjustment flows.
3. Confirm user management flows.
4. Confirm order creation, assignment, and lifecycle transitions.
5. Confirm reports load for a user with `VIEW_REPORTS`.
6. Confirm denied states still deny correctly when permissions are missing.

### Mobile

1. Sign in with a role that should have broad access.
2. Confirm items, orders, activity, and reports screens load.
3. Confirm direct-route deny states still render correctly for missing permissions.
4. Confirm queued delivery actions still recover correctly when connectivity returns.
5. Confirm forced sign-out behavior still returns the client to login after token invalidation.

### Role Checks

At minimum, smoke with:

- an admin-equivalent user
- a driver-scoped user
- a limited non-admin user with selective permissions

## Completion Record

Do not rewrite history. When launch tasks are actually completed, append a dated note here
with:

- what environment was used
- which checks were run
- who performed them
- what remains open, if anything

Until that note exists, this runbook should be treated as **prepared but not executed**.

### 2026-07-17 Partial Execution Note

- Environment: Vercel production `https://let-it-rain-ten.vercel.app`
- Performed by: Codex with user-provided Vercel and Upstash credentials
- Completed:
  - set `APP_URL`
  - set `PUBLIC_SIGNUP_ENABLED=true`
  - rotate `SESSION_SECRET`
  - set `PLATFORM_ADMIN_TOKEN`
  - provision Upstash Redis and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
  - deploy production and verify `/login` returns `200`
  - verify `/api/v1/admin/organizations` returns `401` without token, proving the gate is active
- Still open:
  - Neon branch migration rehearsal
  - end-to-end manual smoke pass on live web/mobile flows
  - verification of the live public-signup flow itself
