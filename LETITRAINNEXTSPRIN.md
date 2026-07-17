# Let It Rain — Active Roadmap

Last updated: 2026-07-17

This is the active roadmap for Let It Rain. It should describe:

- what is already true in the repo
- what is actively open
- what is intentionally deferred

It must not present planned work as completed work.

## Launch Scope

The current launch target is:

- **internal-team use only**
- **not** a public beta
- **not** first paying customers

Deferred until the first-paying-customer phase:

- live Stripe keys and live billing rollout
- transactional email provider
- public signup
- public production-domain rollout
- any claim that the product is customer-ready for paid external use

## Verified Repo State — 2026-07-17

Verified directly in code and tests on Friday, July 17, 2026:

- web tests: `234/234` passing
- mobile tests: `22/22` passing
- password reset and password change both increment `tokenVersion`
- permissions schema default includes all 11 current permissions
- the permissions backfill migration already exists
- signup-token tests already exist
- CSV formula-injection hardening is implemented and tested
- mobile order flows updated on 2026-07-17 no longer depend on `MANAGE_ORDERS`

## Phase 14 — Internal-Team Go-Live

Goal: make the current system safe and operational for the project's own internal team.

### Must complete

1. Deploy configuration
- set `PLATFORM_ADMIN_TOKEN`
- set the internal `APP_URL`
- rotate/set a fresh deploy `SESSION_SECRET`
- decide whether Upstash is required for the internal deployment shape

2. Migration rehearsal
- run migrations against a Neon branch first
- verify row counts and permission/backfill expectations
- only then promote the same migration path to production

3. Launch access policy
- confirm whether public signup stays available or is admin-token-gated for the internal launch period
- document the chosen policy in the runbook

4. Manual smoke pass
- sign in with the relevant internal roles
- verify web + mobile core flows
- verify role-based access still matches the intended permission model

### Nice to have, but not launch blockers

- more observability
- early load testing
- deeper E2E automation

## Phase 15 — Hardening And Cleanup

Goal: close the remaining correctness and governance gaps without inventing fake urgency.

### Open correctness work

1. Audit-log failure semantics
- decide the intended behavior when audit writes fail
- implement that behavior explicitly
- add tests for the chosen failure mode

2. Permission re-sweep
- re-audit web and mobile pages/screens for correct permission gates
- confirm that ownership-based order flows still behave correctly
- add missing regressions where coverage is weak

3. CI and typechecking
- add explicit typecheck scripts for web and mobile
- tighten CI to reflect the actual project expectations

4. Mobile test expansion
- cover more than the current 4 files / 22 tests
- focus first on API client, auth context, offline queue, and higher-risk permissioned screens

### Open documentation/governance work

1. Clean up misleading historical docs
- no file labeled "completion report" should still read like a speculative plan
- planning artifacts must be clearly marked as planning artifacts

2. Keep handoff docs discoverable
- `README.md`, `STATUS.md`, and this roadmap must remain enough for a new agent to orient itself

3. Keep docs synced with code
- changes to behavior require corresponding doc updates in the same change-set

## Phase 16 — First Paying Customer

This phase is deferred until the internal launch is stable.

When it starts, it includes:

1. Live billing
- Stripe live keys
- webhook hardening in live conditions
- billing runbook validation

2. Transactional email
- real provider wiring
- verification email production rehearsal

3. Public signup and public launch posture
- public `APP_URL`
- public signup policy
- first real customer path validation

4. Production-grade operational hardening
- stronger monitoring
- deeper load testing
- first-customer incident drills

## Governance Rules

These rules apply to all future work in this repo:

### Rule 1 — Findability

If an agent is told only "work on Let It Rain", it must be able to locate the current truth from:

- `README.md`
- `STATUS.md`
- `LETITRAINNEXTSPRIN.md`

### Rule 2 — No stale documentation

All relevant documents must be updated with the work being done. There should be no stale document left behind if behavior changed.

### Rule 3 — Truthfulness

Agents must be truthful. They must not claim a task is complete if it has not actually been completed and verified.

### Rule 4 — No silent assumptions

If something is unclear, risky, or blocked, call it out. Do not convert uncertainty into false certainty.

### Rule 5 — Deferred work stays visible

If a task is deferred, it must be recorded here explicitly rather than disappearing.

### Rule 6 — No file deletion without approval

No file deletion without Shayan's explicit approval.
