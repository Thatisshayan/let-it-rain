# PHASE13_INIT.md — Historical Onboarding Note For Phase 13

> Historical document only.
>
> As of **2026-07-17**, **Phase 13 is already complete**. This file is preserved for
> historical context about that phase, but it is **not** the current task list and it
> should not be used as the active source of truth for what to do next.
>
> For current repo state and active work, read these instead:
> 1. `README.md`
> 2. `STATUS.md`
> 3. `LETITRAINNEXTSPRIN.md`
>
> If anything below conflicts with current code or those canon docs, trust the current
> code and canon docs. Treat the rest of this file as phase-specific historical context.

**Original purpose of this file:** get an agent productive on this repo for Phase 13
work without spending tokens re-discovering things already known. At the time it was
written, the intended read order was this file, then `PHASE13.md`, then
`PHASE13ACCEPTANCELIST.md`.

---

## 1. What this project is

`letitrain` — an inventory + order/delivery management app for a small business
("Let It Rain"). Two clients share one backend:
- **Web** — Next.js App Router, `src/app/`
- **Mobile** — Expo/React Native, `mobile/app/` (Expo Router)
- **Database** — one shared Postgres (Neon), accessed via Prisma from the web app;
  mobile talks to the web app's `/api/v1` JSON API, never the DB directly.

At the time this was written, the work in scope was **Phase 13: multi-tenant SaaS
foundation**. That work is no longer the active phase. This file remains only as a
"how the repo worked during that phase" primer.

---

## 2. Repo layout (top level)

```
letitrain/
├── src/                        # Next.js web app
│   ├── app/
│   │   ├── (app)/               # authenticated app routes + co-located service.ts files
│   │   │   ├── items/           #   service.ts = data-access layer for items/movements
│   │   │   ├── orders/          #   service.ts = data-access layer for orders
│   │   │   ├── settings/        #   service.ts = user management, app config
│   │   │   ├── accounts/        #   service.ts = session revocation
│   │   │   ├── audit-log/       #   service.ts = audit log queries
│   │   │   ├── activity/        # calendar/movement history page
│   │   │   ├── reports/         # revenue/COGS reporting page
│   │   │   └── page.tsx         # dashboard
│   │   └── api/v1/               # JSON API — every route wraps service.ts calls
│   │       ├── items/, orders/, users/, activity/, reports/, audit/, auth/, me/...
│   ├── lib/
│   │   ├── auth.ts               # session creation/verification (READ THIS FIRST)
│   │   ├── permissions.ts        # permission constants + hasPermission()
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── login.ts               # login business logic + rate limiting
│   │   └── session-token.ts       # JWT cookie name/alg/secret helpers
│   └── generated/prisma/          # Prisma client output (generated, don't hand-edit)
├── prisma/
│   ├── schema.prisma               # THE schema — read in full before any Phase 13 change
│   ├── migrations/                 # one directory per migration; Phase 1's migration
│   │                                #   (20260712150000_phase1_permissions_audit) is the
│   │                                #   precedent for how to structure a nullable-then-
│   │                                #   backfill-then-required migration
│   └── seed.ts
├── mobile/
│   ├── app/                        # Expo Router screens (mirrors web's route structure)
│   ├── src/api/                    # HTTP client wrappers calling /api/v1
│   ├── eas.json                    # EAS Build profiles (development/preview/staging/production)
│   └── app.json                    # Expo config (bundle id, EAS project id, owner account)
├── LETITRAINNEXTSPRIN.md            # full project roadmap, phased, with completion reports
├── PHASE13.md                       # Phase 13 spec/context (read after this file)
├── PHASE13ACCEPTANCELIST.md         # Phase 13 checklist (the actual done-criteria)
└── docs/
    └── API.md                       # API endpoint reference
```

---

## 3. How to run things

**Web (from repo root):**
```
npm install                 # first time only
npm run dev                 # dev server
npm run build                # production build — must pass before considering work done
npm run lint                  # eslint — must pass, 0 errors
npm test                       # vitest — run before AND after any change
npm run seed                   # seeds the DB (prisma/seed.ts) — check what it seeds before running
```
There is no separate `tsc` script — `npm run build` (Next.js build) is what surfaces
type errors; run it, don't skip it because `npm run lint`/`npm test` passed.

**Mobile (from `mobile/`):**
```
npm install
npm test                       # vitest — 15/15 passing as of Phase 11, don't regress this
npx expo start                  # dev server (not usually needed for Phase 13's backend-heavy work)
```

**Database migrations:**
```
npx prisma migrate dev --name <description>     # creates + applies a new migration locally
npx prisma generate                               # regenerate client after schema changes
```
**Never run a migration against the real production database without explicit
human confirmation first.** Test every Phase 13 migration against a local Postgres
copy (or a Neon branch, which is cheap and fast — Neon supports instant DB branching)
before it's proposed as ready.

---

## 4. Environment variables you'll need locally

Copy `.env.example` to `.env.local` (or `.env`) and fill in:
- `DATABASE_URL` — pooled Postgres connection string (Neon recommended)
- `DIRECT_URL` — unpooled connection, required for Prisma migrations specifically
- `SESSION_SECRET` — JWT signing key, generate with `openssl rand -base64 32`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — optional; rate limiting
  falls back to an in-memory `Map` if unset (fine for local dev, not for production —
  this is a known open item, not something to silently "fix" as part of Phase 13
  unless it's actually blocking your work).

For Phase 13 specifically: strongly consider creating a **Neon database branch** (or
a fully separate local Postgres instance) to develop and test the multi-tenant schema
migration against, rather than the shared dev database other work might be using —
ask the human if unsure which database you should be pointed at before running any
migration.

---

## 5. Architectural conventions already established (follow, don't reinvent)

- **Service layer is the real access-control boundary**, not just the API route
  wrapper. Every `service.ts` file's functions take the caller's `session` object and
  derive scoping (permissions, and as of Phase 0, driver-specific order scoping)
  from it. Phase 13's org-scoping must follow this exact pattern — thread
  `organizationId` through the same session-derived scoping mechanism already used
  for permissions/driver-scoping, don't invent a parallel one.
- **Session is always re-verified against the DB per request**
  (`resolveCurrentSession()` in `src/lib/auth.ts`), never trusted purely from the JWT
  payload — this is what already makes `active`/`tokenVersion` checks instant-effect
  rather than waiting for token expiry. `organizationId` should get the same
  treatment.
- **Migrations follow a nullable → backfill → required pattern** for any change
  touching existing data — see Phase 1's migration for the precedent, and match it
  for Phase 13's `organizationId` backfill.
- **Every phase's work is verified exhaustively, not spot-checked** — Phase 0's
  entire finding was that "spot-checking felt done" left real security holes. Phase
  13's cross-org query-scoping pass must be a genuine function-by-function sweep of
  every `service.ts` file, matching that discipline.
- **Commit style**: conventional-ish prefixes (`fix:`, `feat:`, `chore:`, `docs:`),
  imperative mood, explain *why* not just *what* in the body when non-obvious. Look
  at recent `git log` for the house style before your first commit.
- **Testing**: both web (`vitest`) and mobile (`vitest`/jest via `jest-expo`) suites
  must stay green. Current baselines (confirm current counts before assuming these
  are still accurate — they may have moved since this doc was written):
  web 164+/164 passing, mobile 15/15 passing.
- **No secrets in git.** `.gitignore` already excludes `*.p8`/`*.p12`/`*.key`/
  `*.mobileprovision`/`*.pem`/`.env*`. If Phase 13 work ever touches credentials
  (it shouldn't — this phase is schema/backend, not deploy/signing), keep that
  discipline.

---

## 6. What this file originally pointed agents to do

Historically, this file directed agents to read **`PHASE13.md`** for the full
multi-tenant foundation spec and **`PHASE13ACCEPTANCELIST.md`** for the phase
checklist. That was correct for the original Phase 13 execution window.

Those instructions are no longer current execution guidance. Do not treat them as the
active branching or task policy for the repo today.

**If anything in `PHASE13.md` or the checklist conflicts with what you actually find
in the code** (e.g. a file has moved, a function signature is different than
described, the test-suite baseline counts have changed), trust the code and flag the
discrepancy back to the human rather than either silently deviating from the spec or
blindly forcing the code to match a possibly-stale description.
