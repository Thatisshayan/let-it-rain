# letitrain (Let It Rain) — REPO_DIRECTIVE

> Goal-layer constitution. `REPO_RULES.md` is the law; this is the mission. Every task
> MUST carry `traces-to:`. Orphan tasks rejected by CI (scripts/verify.sh → directive-lint) + Sentinel.

## Vision

letitrain ("Let It Rain") is a small internal inventory / stock-tracking system with a
Next.js web app. North-star: a simple, reliable inventory/stock tracker that does its
one job cleanly — accurate counts, clear UI, no over-engineering. (Vision derived from
README: "small internal inventory / stock-tracking system, Next.js".)

## Non-Goals

- NOT a full ERP / warehouse system.
- NOT adding multi-tenant or commerce without Shayan approval.
- NOT storing inventory PII in repo.

## Phases

### P1 — Current-State Audit (CURRENT)
  exit criteria: README accurate; build+test green; data model documented.
### P2 — Inventory Core
  exit criteria: item + stock CRUD + tracking tested.
### P3 — Polish
  exit criteria: clean responsive UX.

## Sprints

### S1 (maps to P1) — truth + green
  goal: verify.sh passes; model clear.
### S2 (maps to P2) — CRUD
  goal: inventory ops tested.

## Epics / Chapters

### E1 — Core (maps to P1/P2)
  items + stock tracking.
### E2 — Integrity (maps to P1)
  build/test/secret hygiene.
### E3 — UX (maps to P3)
  responsive polish.

## Tasks

- [ ] T1 — Audit README vs code; confirm inventory scope | traces-to: P1/S1/E1 | acceptance: README matches; ? closed
- [ ] T2 — Get build+test green in CI | traces-to: P1/S1/E2 | acceptance: verify.sh passes on PR
- [ ] T3 — Define + test item/stock CRUD | traces-to: P2/S2/E1 | acceptance: CRUD covered by tests
- [ ] T4 — Ensure secrets gitignored + .env.example complete | traces-to: P1/S1/E2 | acceptance: secret-scan clean
- [ ] T5 — Mobile responsive pass on key screens | traces-to: P3/S2/E3 | acceptance: layout correct <768px

## Sentinel Constraints

- auto-approve: docs/tests/typing tracing to P1/E2.
- review-required: data model, auth, external calls, secrets.
- locked: `main`; secrets never; scope changes need Shayan.
