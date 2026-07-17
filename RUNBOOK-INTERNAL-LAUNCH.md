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

- web tests: `236/236`
- mobile tests: `33/33`

## Internal Deploy Configuration

These items are still operationally open until explicitly completed in the target environment:

1. Set `PLATFORM_ADMIN_TOKEN`.
2. Set the internal `APP_URL`.
3. Rotate or set a fresh deploy `SESSION_SECRET`.
4. Decide whether Upstash is required for the actual internal deployment shape.

Record the exact deployed values outside git if they are sensitive. This repo should only
record that the step was performed, not the secret values themselves.

## Migration Rehearsal

Run this before touching the production database:

1. Create or choose a Neon branch for rehearsal.
2. Point the app and Prisma migration flow at that branch.
3. Run the exact migration path intended for production.
4. Verify row counts and organization/permission expectations.
5. Verify the app still boots and authenticates against the rehearsed database.
6. Only after a clean rehearsal, run the same migration path against production.

Minimum checks after rehearsal:

- users still authenticate
- permissions still resolve as expected
- item/order/activity/report reads still work
- no unexpected null/backfill drift appears in key tables

## Launch Access Policy

Before internal launch, explicitly choose one of these:

1. Public signup remains enabled temporarily.
2. Public signup is gated behind admin-controlled flow for the internal period.

Whichever policy is chosen, document it here and in `LETITRAINNEXTSPRIN.md` if the
roadmap state changes.

Current status on 2026-07-17:

- no verified decision recorded yet in this repo

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
