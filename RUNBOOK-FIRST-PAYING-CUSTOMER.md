# Runbook — First Paying Customer

Last updated: 2026-07-17

This runbook is **deferred** until the internal launch is stable.

Do not treat this file as active execution guidance yet. It exists so the next phase is
discoverable and so the repo has a truthful home for the still-deferred operational work.

For current active work, read:

1. `README.md`
2. `STATUS.md`
3. `LETITRAINNEXTSPRIN.md`

## Entry Condition

Do not begin this runbook until all of the following are true:

- the internal-team launch is live and stable
- internal smoke testing is complete
- deploy configuration and migration rehearsal are already done
- there is an explicit decision to begin first-paying-customer work

## Scope

When this phase starts, it includes:

1. Live billing
- Stripe live keys
- webhook hardening in live conditions
- negative-path webhook coverage where billing code resumes
- billing runbook validation

2. Transactional email
- production email provider selection and wiring
- verification/reset/relevant operational email rehearsal

3. Public launch posture
- public `APP_URL`
- final public signup policy
- first real customer path validation

4. Operational hardening
- stronger monitoring
- deeper load testing
- incident drills for first-customer scenarios

## Required Outputs

When this phase becomes active, this runbook should be expanded with:

- environment checklist
- billing cutover steps
- rollback plan
- customer-facing validation checklist
- support/incident contact path

Current status on 2026-07-17:

- intentionally deferred
- not yet executed
- not yet expanded into a production cutover checklist
