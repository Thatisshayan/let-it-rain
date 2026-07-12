# 🌧️ Let It Rain

A small internal inventory / stock-tracking system with a Next.js web app, a
React Native (Expo) mobile app, and a shared JSON API. Track items, receive/
remove/adjust stock with a full movement (audit) history, manage users and
per-user permissions, browse activity on a calendar, and pull lean accounting
reports (revenue, COGS, profit, inventory valuation) — from a desktop browser
or a phone.

## Contents

- [Apps in this repo](#apps-in-this-repo)
- [Stack](#stack)
- [Getting started — web app](#getting-started--web-app)
- [Getting started — mobile app](#getting-started--mobile-app)
- [Testing](#testing)
- [Data model](#data-model)
- [Authorization model](#authorization-model)
- [Features](#features)
- [The `/api/v1` layer](#the-apiv1-layer)
- [Notable implementation details](#notable-implementation-details)
- [Project structure](#project-structure)
- [Deploy](#deploy)

## Apps in this repo

| App | Location | What it is |
|---|---|---|
| **Web** | `src/` (repo root) | Next.js App Router app — the original, full-featured UI. Server Actions + cookie-based sessions. |
| **API** | `src/app/api/v1/` | A versioned JSON API sitting alongside the web app, backed by the exact same Prisma logic (shared `service.ts` modules) as the web Server Actions. Built specifically to power the mobile app, but usable by any client. Bearer-token (JWT) auth. |
| **Mobile** | `mobile/` | An Expo (React Native + TypeScript) app that consumes `/api/v1`. Has full feature parity with the web app: inventory, settings/users, activity calendar, and reports. See [`mobile/README.md`](mobile/README.md) for mobile-specific setup. |

The web app and the API are two faces of the same Next.js project (same `npm run dev`,
same database, same business logic) — there's nothing extra to run to expose the API.
The mobile app is a separate Node project in `mobile/` that talks to the API over HTTP.

## Stack

**Web / API (repo root):**
- **Next.js 16** (App Router, Server Actions, Route Handlers, `proxy.ts` route protection)
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter, targeting PostgreSQL
- **jose** for JWT sessions (cookie-based for web, Bearer-token for the API), **bcryptjs** for password hashing
- **zod** for input validation on every Server Action and API route
- **shadcn/ui** + Tailwind v4 for UI
- **vitest** for unit and integration tests

**Mobile (`mobile/`):**
- **Expo** (React Native + TypeScript) with **Expo Router** (file-based routing, mirroring the web app's App Router conventions)
- **@tanstack/react-query** for data fetching, caching, and mutations against `/api/v1`
- **expo-secure-store** for storing the auth token on-device

## Getting started — web app

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` (or `.env.local`) with:

   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/dbname"
   SESSION_SECRET="a long random string used to sign session JWTs"
   ```

   (`npx create-db` can provision a free hosted Postgres instance if you don't
   have one.) `SESSION_SECRET` signs both the web app's session cookie **and**
   the mobile API's Bearer tokens — it's the same secret, the same `jose`
   signing logic, just delivered two different ways (cookie vs. header).

3. Apply the database schema:

   ```bash
   npx prisma migrate deploy   # or `npx prisma migrate dev` in local dev
   npx prisma generate         # regenerates src/generated/prisma — required after any schema change, and after a fresh clone
   ```

4. Seed an initial user (see `prisma/seed.ts` for the default credentials it creates):

   ```bash
   npm run seed
   ```

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded user.
   (If port 3000 is already in use, Next.js picks the next free port automatically —
   check the terminal output for the actual URL.)

## Getting started — mobile app

The mobile app is a separate Expo project in `mobile/` that talks to the web app's
`/api/v1` endpoints over HTTP. You need the web app's dev server running (step 5 above)
before the mobile app can do anything useful.

1. Install mobile dependencies:

   ```bash
   cd mobile
   npm install
   ```

2. Point the mobile app at your API server:

   ```bash
   cp .env.example .env
   ```

   Edit `mobile/.env` and set `EXPO_PUBLIC_API_BASE_URL` to your machine's **LAN IP**
   (not `localhost` — a physical phone running Expo Go is a separate device on the
   network and can't resolve your computer's `localhost`):

   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:3000
   ```

   Find your LAN IP with `ipconfig` (Windows) or `ifconfig`/`ip addr` (macOS/Linux).

3. Start Expo:

   ```bash
   npx expo start
   ```

   Scan the printed QR code with the **Expo Go** app (iOS: Camera app; Android: Expo
   Go's built-in scanner). Make sure your phone and computer are on the same Wi-Fi
   network — this is the most common cause of connection failures. If it still won't
   connect (corporate/guest network isolation, firewalls), fall back to
   `npx expo start --tunnel` (slower, but routes around network restrictions).

4. Sign in with the same seeded credentials as the web app.

Full mobile-specific documentation — screen-by-screen breakdown, project structure,
and troubleshooting — lives in [`mobile/README.md`](mobile/README.md).

## Testing

```bash
npm test
```

Runs the full Vitest suite for the web app and API: stock-movement math
(`src/app/(app)/items/movement.ts`), custom-field parsing, the shared service modules
(`items/service.ts`, `settings/service.ts`) covering every permission check and
self-protection guard, and every `/api/v1/*` Route Handler (auth, permission
enforcement, validation, and success paths). The mobile app has no automated test suite
of its own — it's a thin client over the already-tested API, verified manually via
Expo Go.

## Data model

- **User** — an authenticated person with a `permissions` array (see
  [Authorization model](#authorization-model) below) and an `active` flag. Deactivated
  users can't sign in but their historical `Movement` rows are preserved.
- **Item** — a tracked inventory item (`quantity`, `minStock`, optional
  `category`/`customFields`, plus `unitCost`/`unitPrice` for accounting). Deletion is a
  *soft delete* (`deletedAt`): deleted items disappear from every view but their
  `Movement` history is preserved for audit purposes rather than being cascade-deleted.
- **Movement** — an immutable log row created whenever stock is received, removed, or
  count-adjusted. This is the audit trail; it is never edited or deleted directly. Also
  carries `isSale`/`unitCostAtTime`/`unitPriceAtTime` for the accounting reports (a
  `REMOVE` movement can be flagged as a sale, snapshotting the item's price/cost at that
  moment so later cost changes don't retroactively distort historical reports).

## Authorization model

Every user has a `permissions: string[]` field on the `User` model, checked via
`hasPermission(session, permission)` (`src/lib/permissions.ts`) in every Server Action
and every `/api/v1` Route Handler that mutates data. The four permissions:

| Permission | Grants |
|---|---|
| `MANAGE_USERS` | Create users, edit any user's permissions, activate/deactivate users, reset any user's password |
| `EDIT_ITEMS` | Create and edit items |
| `DELETE_ITEMS` | Soft-delete items |
| `ADJUST_STOCK` | Receive/remove/adjust stock (create movements) |

New users get all four permissions by default (the `User.permissions` Prisma field
default), but an admin can revoke any of them per-user via Settings → Users. Two
**self-protection guards** prevent an admin from locking themselves out, enforced
server-side in `settings/service.ts` (and reused by both the web Server Actions and the
mobile API):

- An admin **cannot remove their own `MANAGE_USERS` permission**.
- An admin **cannot deactivate their own account**.

Session JWTs are long-lived (30 days), but they aren't a static permissions snapshot:
`getSession()`/`verifyBearerToken()` (`src/lib/auth.ts`) re-fetch the `User` row by id on
every call and return the **current** DB permissions/active status rather than trusting
whatever was embedded in the token at login. A revoked permission or a deactivation takes
effect on the user's very next request — it doesn't wait for the token to expire or for
them to log out and back in.

Viewing items, the activity calendar, and accounting reports requires no specific
permission beyond being signed in — those are read-only and open to every authenticated
user.

## Features

### Inventory (web + mobile)
- Browse/search items, filter to low-stock (`quantity < minStock`) items — surfaced as a
  count badge in the web nav bar, linking to `/items?low=1`.
- Item detail with full movement (audit) history.
- Create/edit items, including cost/price fields used by accounting reports.
- Receive, remove, or count-adjust stock, with an optional reason and (for removals) an
  `isSale` flag that feeds the reports below.
- CSV export of the item list and of a single item's movement history (web only, at
  `/items/export.csv` and `/items/[id]/movements/export.csv`).

### Settings & user management (web + mobile)
- Admins (`MANAGE_USERS`) can create users, edit their permissions, activate/deactivate
  them, and reset their password.
- Every signed-in user can edit their own name and change their own password.

### Activity calendar (web + mobile)
- A month-grid view of stock movements, with a colored net-change badge per day
  (green = net positive, red = net negative, blue = net zero but active).
- Tap/click a day to see that day's individual movements (item, type, delta, reason,
  who did it, when).

### Accounting / reports (web + mobile)
- Today's revenue, this month's revenue/COGS/gross profit, this month's restock cost,
  and current inventory valuation (across all non-deleted items).
- Revenue-by-day and sales-by-item breakdowns for the selected month.
- "Revenue" here means sale-flagged `REMOVE` movements (`isSale: true`) valued at the
  item's price *at the time of the sale* (`unitPriceAtTime`), not its current price —
  so re-pricing an item doesn't rewrite history.

## The `/api/v1` layer

The mobile app doesn't talk to Server Actions (React Native has no cookie jar and no
RSC-payload POST contract). Instead, every mutation the web app can perform is also
exposed as a versioned JSON Route Handler under `src/app/api/v1/`, authenticated with a
`Bearer <jwt>` header instead of a session cookie.

**Design principle:** the API never duplicates business logic. Every mutation's actual
Prisma calls, validation, and permission checks live in one shared, framework-agnostic
`service.ts` module per feature area (`items/service.ts`, `settings/service.ts`); both
the web Server Action and the API Route Handler call the exact same function. This means
a bug fix or business-rule change only needs to happen once, and web/mobile can never
drift out of sync on what's allowed.

A full endpoint-by-endpoint reference — request/response shapes, auth requirements,
status codes — lives in [`docs/API.md`](docs/API.md).

Quick summary of what's exposed:

| Area | Endpoints |
|---|---|
| Auth | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` |
| Items | `GET/POST /api/v1/items`, `GET/PATCH/DELETE /api/v1/items/:id`, `POST /api/v1/items/:id/movements` |
| Users | `GET/POST /api/v1/users`, `PATCH /api/v1/users/:id/permissions`, `PATCH /api/v1/users/:id/active`, `POST /api/v1/users/:id/reset-password` |
| Account | `PATCH /api/v1/account`, `POST /api/v1/account/password` |
| Activity | `GET /api/v1/activity` |
| Reports | `GET /api/v1/reports` |

`src/proxy.ts` (the route-protection middleware) exempts everything under `/api/v1` from
its cookie-based redirect-to-login behavior — each `/api/v1` route does its own
`verifyBearerToken` check instead, since it has no cookie to check in the first place.

## Notable implementation details

- **Concurrency:** stock adjustments (`adjustStock` in `items/service.ts`) run inside a
  `SERIALIZABLE` Prisma transaction with retry-on-conflict, so two simultaneous
  adjustments to the same item can't silently overwrite each other (lost update). This
  is shared by both the web form and the mobile API, so the guarantee holds no matter
  which client made the call.
- **Rate limiting:** login attempts go through `attemptLogin` (`src/lib/login.ts`),
  shared by both the web login Server Action and the `POST /api/v1/auth/login` route
  used by mobile — the limiter is not web-only. Two buckets are checked per attempt:
  10 attempts / 15 min per `ip:email`, and a coarser 30 attempts / 15 min per `ip`
  alone (the second bucket exists so an attacker can't dodge the per-email limit by
  spraying guesses across many different email addresses from one IP). Both use
  `checkRateLimit` (`src/lib/rate-limit.ts`): Upstash Redis when
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are configured (durable,
  multi-instance safe), otherwise an in-memory Map — correct for a single instance
  but silently non-durable across replicas without Upstash configured.
- **Low stock:** items with `quantity < minStock` are flagged throughout both UIs.
- **Weighted-average costing:** receiving stock at a new unit cost recomputes the item's
  `unitCost` as a quantity-weighted average of the existing stock and the new batch
  (`nextWeightedAverageCost` in `items/movement.ts`), rather than simply overwriting it —
  so cost tracking stays accurate when the same item is restocked at different prices
  over time.
- **Historical accuracy in reports:** sale movements snapshot `unitPriceAtTime` and
  `unitCostAtTime` at the moment of the sale, so editing an item's current price/cost
  later doesn't retroactively change past revenue/profit figures.
- **Mobile money formatting:** the mobile Reports screen uses a small manual `$X,XXX.XX`
  formatter instead of `toLocaleString('en-US', {style:'currency'})`, since some
  React Native JS engines (Hermes on older SDKs) ship a stripped-down `Intl`
  implementation that can't be relied on for currency formatting.

## Project structure

```
letitrain/
├── prisma/                      # schema, migrations, seed script
├── src/
│   ├── app/
│   │   ├── (app)/                # web app pages (protected by proxy.ts)
│   │   │   ├── items/            # inventory: list, detail, new/edit, service.ts
│   │   │   ├── settings/         # user management + own account, service.ts
│   │   │   ├── activity/         # activity calendar page + calendar.ts (pure helpers)
│   │   │   └── reports/          # accounting reports page + reports.ts (pure helpers)
│   │   ├── api/v1/               # the JSON API — mirrors (app)/ feature-by-feature
│   │   └── login/                # public login page
│   ├── lib/                      # auth (session + bearer JWT), permissions, prisma client, etc.
│   └── generated/prisma/         # generated Prisma client (regenerate after schema changes)
├── mobile/                       # Expo app — see mobile/README.md
├── docs/
│   ├── API.md                    # full /api/v1 endpoint reference
│   └── superpowers/
│       ├── specs/                # design docs for each phase of work
│       └── plans/                # implementation plans for each phase of work
└── README.md                     # this file
```

`docs/superpowers/specs/` and `docs/superpowers/plans/` contain the design and
implementation-plan documents written before each phase of the mobile app work (core
inventory, settings/users, activity calendar, accounting/reports) — useful background if
you want to understand *why* something was built a particular way, not just *what* it
does.

## Deploy

**Web app:** the easiest way to deploy is [Vercel](https://vercel.com/new). Make sure
`DATABASE_URL` and `SESSION_SECRET` are set as environment variables, and that
migrations have been applied to the target database before the app receives traffic.
Deploying the web app also deploys the `/api/v1` layer — there's nothing separate to
stand up for the mobile app's backend.

**Mobile app:** this repo currently only supports development builds via Expo Go (no
EAS Build / app-store submission configured). Point `EXPO_PUBLIC_API_BASE_URL` at your
deployed web app's URL to use the mobile app against production data. Setting up EAS
Build for internal distribution or app-store submission is a separate, not-yet-started
piece of work.
