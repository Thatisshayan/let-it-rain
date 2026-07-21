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
- external paid-customer launch (self-service signup is intentionally enabled for the current internal deployment)
- public production-domain rollout
- any claim that the product is customer-ready for paid external use

## Verified Repo State — 2026-07-17

Verified directly in code and tests on Friday, July 17, 2026:

- web tests: `237/237` passing
- mobile tests: `110/110` passing
- root web/API `typecheck`: passing
- mobile `typecheck`: passing
- password reset and password change both increment `tokenVersion`
- permissions schema default includes all 11 current permissions
- the permissions backfill migration already exists
- signup-token tests already exist
- CSV formula-injection hardening is implemented and tested
- mobile order flows updated on 2026-07-17 no longer depend on `MANAGE_ORDERS`
- explicit web/mobile `typecheck` scripts exist, and CI runs them
- audit-covered user/session mutations and order lifecycle writes fail closed atomically
- web/mobile permission re-sweep completed; direct-route mobile permission gaps were closed
- Phase 13 historical docs are explicitly marked as historical context rather than active execution guidance
- current GitHub Actions CI is green for commit `24496d7` (run `29614610882`)

## Phase 14 — Internal-Team Go-Live

Goal: make the current system safe and operational for the project's own internal team.

### Must complete

1. Deploy configuration
- production Vercel deploy now uses `https://let-it-rain-ten.vercel.app`
- `PLATFORM_ADMIN_TOKEN`, `APP_URL`, rotated `SESSION_SECRET`, and Upstash REST envs were set on 2026-07-17
- Upstash Redis is now provisioned for shared rate limiting
- public signup is intentionally enabled in production via `PUBLIC_SIGNUP_ENABLED=true`
- the production app now runs against a fresh Neon backend (`square-shadow-17526702`) that was migrated, seeded, and live-login verified on 2026-07-17

2. Migration rehearsal
- run future migrations against a Neon branch first
- verify row counts and permission/backfill expectations
- only then promote the same migration path to production

3. Launch access policy
- deploy-time setting is now explicit: production public signup is enabled intentionally
- keep `PLATFORM_ADMIN_TOKEN` for the separate admin-controlled org bootstrap path
- live API smoke has validated signup/auth successfully
- remaining work is UI/device-level validation of that path

4. Manual smoke pass
- sign in with the relevant internal roles
- verify web + mobile core flows
- verify role-based access still matches the intended permission model
- API-level production smoke already passed on 2026-07-17
- protected web-route production smoke also passed on 2026-07-17 for `/`, `/items`, `/orders`, `/reports`, `/settings`, and `/activity`
- remaining work is mobile UI/device execution and role-based manual validation beyond the authenticated admin web pass

### Nice to have, but not launch blockers

- more observability
- early load testing
- deeper E2E automation

## Phase 15 — Hardening And Cleanup

Goal: close the remaining correctness and governance gaps without inventing fake urgency.

### Open correctness work

1. Mobile test expansion
- cover more than the current 27 files / 110 tests
- focus first on API client, auth context, offline queue, and higher-risk permissioned screens

2. Mobile UI/UX polish (Phase 0 complete)
- design system foundation: `design-tokens.ts`, `useAccessibility` hook, `haptics.ts`, `motion.ts`
- UI primitives: Box, Text, Pressable, Input, Card, State
- reduced-motion support for skeleton/toast animations
- dynamic type scaling support
- haptic feedback integration

3. Login screen redesign
- improve accessibility labels and error handling
- add "Forgot password?" link
- better visual hierarchy for the login form

4. Dashboard screen redesign
- improve information density and actionability
- clearer stat tile presentation
- better low-stock identification

### Open documentation/governance work

1. Keep handoff docs discoverable
- `README.md`, `STATUS.md`, and this roadmap must remain enough for a new agent to orient itself

2. Keep docs synced with code
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
