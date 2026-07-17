# Let It Rain Audit And Corrected Execution Plan

Date: 2026-07-17
Scope: repo index refresh, code audit, roadmap sanity check, corrected next-steps plan

## What I Verified

- The repository is indexed in `codebase-memory-mcp` as `D-AgentDevWork-repos-letitrain` and was re-indexed on 2026-07-17.
- The repo is a Next.js 16 + Prisma 7 web/API app with an Expo mobile app in `mobile/`.
- The workspace is not clean. There are existing user changes in `prisma/schema.prisma`, `src/app/(app)/settings/service.ts`, tests, and several roadmap docs.
- Web tests are currently failing: `235/236` passing, `1` failing.
- Mobile tests are currently passing: `19/19`.

## Brief Audit

### 1. Current red state is small but real

The most immediate issue is not a deep architecture flaw. It is a correctness drift between code and tests:

- `src/app/(app)/settings/service.ts` now increments `tokenVersion` in both `resetUserPassword` and `changeOwnPassword`.
- `src/app/(app)/settings/service.test.ts` still has an older expectation for `resetUserPassword` that omits `tokenVersion: { increment: 1 }`.
- Result: the web suite is red even though the implementation is moving in the right direction.

This should be treated as the first unblocker.

### 2. The existing roadmap overstates what is still open

Several items in `LETITRAINNEXTSPRIN.md`, `STATUS.md`, and the copied "completion report" are already partly or fully landed in code:

- `prisma/schema.prisma` already includes `VIEW_AUDIT_LOG` and `MANAGE_SETTINGS` in the default permissions array.
- `prisma/migrations/20260717000000_backfill_new_permissions/migration.sql` already exists.
- `src/lib/signup.test.ts` already covers unknown, consumed, expired, and valid verification-token paths.
- Mobile Sentry is already wired via `mobile/app/_layout.tsx` and `mobile/src/sentry.ts`.
- Password-change/reset token revocation logic has already been added in `src/app/(app)/settings/service.ts`.

The plan should stop presenting these as untouched future tasks and instead distinguish:

- landed but not fully verified
- landed but docs/tests not synced
- still genuinely open

### 3. There is still a real permission-drift problem

The web canonical list in `src/lib/permissions.ts` contains 11 permissions and does not include `MANAGE_ORDERS`.

The mobile-side list in `mobile/src/api/settings.ts` still hardcodes:

- `MANAGE_ORDERS`
- plus the newer split order permissions

That is a genuine drift bug and a better justification for a shared permission source than the older generic plan gave.

### 4. Some "completion" documentation is not trustworthy as completion documentation

`docs/completion-reports/2026-07-16-Phase14-GoLive-Internal.md` reads like a copied plan, not a verified completion report. It lists future tasks and milestones instead of executed outcomes.

That creates a governance problem:

- a new agent can mistake planned work for finished work
- `STATUS.md` and `LETITRAINNEXTSPRIN.md` become harder to trust

This repo needs a stricter rule: no file should be called a completion report unless the work was actually done and verified.

### 5. A few real gaps remain and are better defined now

Confirmed open or likely-open items:

- CSV formula-injection hardening is not yet implemented in `src/lib/csv.ts`.
- Web/mobile permissions are still duplicated and currently inconsistent.
- Typecheck scripts are still missing from root `package.json`.
- Launch wiring items like `PLATFORM_ADMIN_TOKEN`, internal `APP_URL`, and Neon migration dry-run are operational tasks, not code-complete tasks.

Items that should be re-prioritized lower until closer to launch:

- Sentry for web
- k6 load testing
- Maestro E2E
- broader observability work

Those are useful, but they should not outrank fixing the red suite and document drift.

## Corrected Execution Plan

### Phase 1. Stabilize truth first

Goal: make code, tests, and docs agree on what is already done.

1. Fix the failing web test in `src/app/(app)/settings/service.test.ts`.
2. Re-run root and mobile test suites.
3. Rewrite `LETITRAINNEXTSPRIN.md` and `STATUS.md` so they reflect actual repo state:
   - mark landed items as landed
   - keep only real open work open
   - remove fake future framing from already-implemented tasks
4. Replace or relabel `docs/completion-reports/2026-07-16-Phase14-GoLive-Internal.md` so it is no longer presented as a completion report if it is still a plan.

Exit criteria:

- web tests green
- mobile tests green
- no roadmap document claiming unfinished work is complete
- no completion report naming planned work as completed work

### Phase 2. Close the real correctness gaps

Goal: finish the small number of verified open issues.

1. Implement CSV formula-injection protection in `src/lib/csv.ts` and add tests.
2. Eliminate permission drift by moving web and mobile onto one shared permission source.
3. Remove the legacy `MANAGE_ORDERS` zombie from mobile permission selection unless a specific compatibility reason still exists.
4. Decide and implement explicit audit-log failure semantics only after the current workspace changes in auth/settings are stable.

Exit criteria:

- CSV tests added and passing
- one canonical permission list used by both apps
- no stale legacy permission in mobile UI/API helpers

### Phase 3. Only then do launch-hardening work

Goal: do launch tasks after the repo is internally honest and green.

1. Add `typecheck` scripts for web and mobile.
2. Confirm env requirements for internal launch:
   - `SESSION_SECRET`
   - `APP_URL`
   - `PLATFORM_ADMIN_TOKEN`
   - Upstash envs if rate limiting must survive multi-instance deployment
3. Run the migration dry-run on a Neon branch before touching production.
4. Perform role-based manual smoke testing on web and mobile.

Exit criteria:

- test + typecheck baseline exists
- migration rehearsal is documented
- internal launch checklist is executable, not aspirational

### Phase 4. Defer the right things explicitly

These should remain deferred until the internal launch baseline is clean:

- live Stripe rollout
- public signup exposure
- web Sentry if no DSN/response workflow exists yet
- load testing beyond a basic smoke pass
- expanded E2E automation

Deferred work should stay in the roadmap, but it should stop competing with immediate repo-truth and correctness work.

## Recommended Repo Rules

These are the guardrails I recommend keeping and enforcing:

### 1. Findability

If an agent is told only "work on Let It Rain", the read order should be obvious:

1. `README.md`
2. `STATUS.md`
3. `LETITRAINNEXTSPRIN.md`
4. the relevant runbook or ADR

That chain should be maintained deliberately.

### 2. No stale docs

If code changes behavior, the relevant doc changes in the same PR or change-set.

At minimum this means syncing:

- `STATUS.md`
- `LETITRAINNEXTSPRIN.md`
- relevant API/runbook/ADR docs

### 3. No false completion

A task is only complete when all three are true:

- implementation exists
- verification ran
- docs reflect the verified state

Anything else is in progress, not done.

### 4. Completion reports must be evidence-based

A completion report should contain:

- what changed
- what was verified
- what remains open

If it still reads like a plan, it is not a completion report.

### 5. Audit reports should be dated snapshots, not canon

Audit snapshots are useful, but canon should remain:

- `STATUS.md` for current state
- `LETITRAINNEXTSPRIN.md` for active roadmap
- runbooks for operations
- ADRs for decisions

## Recommended Immediate Order

If you want the next execution pass to be high-value, the order should be:

1. fix the failing settings test
2. implement CSV hardening and its tests
3. unify permissions and remove mobile drift
4. sync roadmap/status/completion-report docs to reality
5. then tackle launch-only operational work

That is materially tighter than the earlier plan and matches the repo as it actually exists on 2026-07-17.
