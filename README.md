# 🌧️ Let It Rain

A small internal inventory / stock-tracking system with a Next.js web app, a
React Native (Expo) mobile app, and a shared JSON API. Track items, receive/
remove/adjust stock with a full movement (audit) history, manage users and
per-user permissions, browse activity on a calendar, and pull lean accounting
reports (revenue, COGS, profit, inventory valuation) — from a desktop browser
or a phone.

## Start Here

If you're new to this repo, read these first:

1. [`STATUS.md`](STATUS.md) — current verified state and repo rules
2. [`LETITRAINNEXTSPRIN.md`](LETITRAINNEXTSPRIN.md) — active roadmap
3. [`RUNBOOK-INTERNAL-LAUNCH.md`](RUNBOOK-INTERNAL-LAUNCH.md) — launch operations for the internal-team phase

As of **2026-07-17**, the current verified test state is:

- web: `234/234` passing
- mobile: `22/22` passing

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

Web / API:

```bash
npm test
```

```bash
npm run typecheck
```

Mobile:

```bash
npm --prefix mobile test
```

```bash
npm --prefix mobile run typecheck
```

The root Vitest suite covers the web app and API: stock-movement math
(`src/app/(app)/items/movement.ts`), custom-field parsing, shared service modules,
and `/api/v1/*` route handlers.

The mobile app also has an automated Vitest suite now. It is still much smaller than
the web suite, but it exists and should be kept green alongside the web tests.

The web typecheck uses the Next 16-supported flow `next typegen && tsc --noEmit`,
and clears stale `.next/dev/types` first so a corrupted local dev artifact cannot
poison CI or local type validation.

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
  carries `isSale`/`cashAmount`/`interacAmount`/`unitCostAtTime`/`unitPriceAtTime` for the
  accounting reports (a `REMOVE` movement is a sale whenever `cashAmount + interacAmount`
  is greater than `0`; both amounts and the item's cost are snapshotted at that moment so
  later price/cost changes don't retroactively distort historical reports).

## Authorization model

Every user has a `permissions: string[]` field on the `User` model, checked via
`hasPermission(session, permission)` (`src/lib/permissions.ts`) in every Server Action
and every `/api/v1` Route Handler that mutates data. Permissions (11 in total):

| Permission | Grants |
|---|---|
| `MANAGE_USERS` | Create users, edit any user's permissions, activate/deactivate users, reset any user's password, revoke another user's sessions |
| `EDIT_ITEMS` | Create and edit items |
| `DELETE_ITEMS` | Soft-delete items |
| `ADJUST_STOCK` | Receive/remove/adjust stock (create movements) |
| `CREATE_ORDERS` | Create orders, see every order |
| `ASSIGN_DRIVERS` | Assign/reassign drivers, see every order |
| `CANCEL_ORDERS` | Cancel orders, see every order |
| `VIEW_REPORTS` | Read accounting reports (revenue, COGS, profit, valuation) |
| `VIEW_COSTS` | See `unitCost`/`unitPrice`/`stockValue` on items in the web/mobile UI |
| `VIEW_AUDIT_LOG` | Read the system audit log (admin "who did what") |
| `MANAGE_SETTINGS` | (Reserved — for a future Settings → App settings tab) |

The legacy `MANAGE_ORDERS` umbrella is no longer the active model. Order access is now
expressed through the three explicit permissions above plus driver ownership rules. The
historical migration logic lives in `scripts/permissions-migration/migrate.ts`.

An order's **assigned driver** is a separate, non-permission authorization path: they can
act on that one order (mark it out-for-delivery/delivered) without holding
any of the three order perms, the same "ownership check, not permission check" pattern used
for own-account actions — see [Orders](#orders-driver-deliveries) below.

New users get the default permission set (currently all 11 perms via the `User.permissions`
Prisma field default), but an admin can revoke any of them per-user via Settings → Users.
Two **self-protection guards** prevent an admin from locking themselves out, enforced
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

The same JWT also carries a `tokenVersion` claim. An admin can **forcibly invalidate
every session for a user** (via Settings → Users → user detail → "Sign out everywhere",
or `POST /api/v1/users/:id/revoke-sessions`) which bumps that user's `tokenVersion`.
The next request from any of that user's still-valid JWTs fails verification with `401`
because the embedded `tokenVersion` no longer matches the DB's current value, dropping the
client back to the login screen on every device simultaneously. Users can do the same
to themselves via Account → "Sign out everywhere" (`POST /api/v1/me/sessions`).

Viewing items, the activity calendar, and accounting reports requires the corresponding
permission (`VIEW_COSTS`, scoped `VIEW_REPORTS`) beyond being signed in — read-only
access is no longer a default. Every page that shows the underlying data
(`Activity`, `Reports`, the item detail's cost block, the Settings → Audit log tab) checks
the permission server-side and renders a "permission denied" state if missing — so a
direct URL or API hit still gets `403` from the API layer.

## Features

### Inventory (web + mobile)
- Browse/search items, filter to low-stock (`quantity < minStock`) items — surfaced as a
  count badge in the web nav bar, linking to `/items?low=1`.
- Item detail with full movement (audit) history.
- Create/edit items, including cost/price fields used by accounting reports.
- Receive, remove, or count-adjust stock, with an optional reason and (for removals)
  optional Cash/Interac split amounts that feed the reports below — a removal is recorded
  as a sale whenever their sum is greater than `0`.
- CSV export of the item list and of a single item's movement history — the web pages at
  `/items/export.csv`/`/items/[id]/movements/export.csv` (cookie session auth) and the
  equivalent `/api/v1/items/export.csv`/`/api/v1/items/:id/movements/export.csv` (Bearer
  auth, used by mobile's share-sheet export) return the same data.

### Settings & user management (web + mobile)
- Admins (`MANAGE_USERS`) can create users, edit their permissions, activate/deactivate
  them, and reset their password.
- Every signed-in user can edit their own name and change their own password.

### Orders (driver deliveries) (web + mobile)
- Users with `CREATE_ORDERS` create orders.
- Users with `ASSIGN_DRIVERS` assign or reassign drivers.
- Users with `CANCEL_ORDERS` cancel orders.
- The assigned driver — without needing any of those three permissions — marks their own order
  out-for-delivery, then delivered.
- Marking delivered captures optional per-line-item Cash/Interac payment, exactly like a
  manual stock removal: whenever a line item's payment is greater than `0`, it becomes a
  sale-flagged `REMOVE` movement and flows into the Accounting/Reports totals below with
  no separate delivery-accounting system. All line items in a delivery are decremented in
  one all-or-nothing `SERIALIZABLE` transaction — if any single item can't be fulfilled
  (e.g. insufficient stock), nothing is written.
- Mobile has an offline queue for the out-for-delivery/delivered actions specifically
  (not the whole app): a driver can confirm a delivery with no signal, and it syncs
  automatically once back online. See [`mobile/README.md`](mobile/README.md) for how.

### Activity calendar (web + mobile)
- A month-grid view of stock movements, with a colored net-change badge per day
  (green = net positive, red = net negative, blue = net zero but active).
- Tap/click a day to see that day's individual movements (item, type, delta, reason,
  who did it, when).
- Scoped per role: order-management perms (`CREATE_ORDERS`/`ASSIGN_DRIVERS`/
  `CANCEL_ORDERS`) and `VIEW_AUDIT_LOG` holders see every movement company-wide;
  drivers and others get only the `Movement` rows they themselves authored — checked
  server-side in `src/app/api/v1/activity/route.ts` and `src/app/(app)/activity/page.tsx`
  so a direct URL can't bypass it.

### Accounting / reports (web + mobile)
- Today's revenue, this month's revenue/COGS/gross profit, this month's Cash/Interac
  breakdown, this month's restock cost, and current inventory valuation (across all
  non-deleted items).
- Revenue-by-day (rendered as a lightweight bar chart on both web and mobile — plain
  `<div>`/`View` width percentages, no charting library) and sales-by-item breakdowns for
  the selected month.
- "Revenue" here means sale-flagged `REMOVE` movements (`isSale: true`) valued at the
  *effective* price actually paid (`(cashAmount + interacAmount) / units`), snapshotted as
  `unitPriceAtTime` at the moment of sale — so re-pricing an item doesn't rewrite history,
  and the figure reflects what was actually collected even if it differs from the item's
  list price.
- Gated by `VIEW_REPORTS` — the API returns `403` for users without it, the web
  `/reports` page redirects-with-message, and on mobile the Reports tab and the
  Dashboard's "Today's revenue" card both hide.

### Audit log (web)
- Settings → Audit log tab (`VIEW_AUDIT_LOG`) — every user/perms/session change and
  every order lifecycle event is recorded with actor, target, timestamp, and a
  human-readable detail via `src/lib/audit.ts` (`writeAuditLog`), called from the user and
  order service layers. The web UI is a server-rendered list (paginated via `?page=`/`?pageSize=`
  query params on the underlying query); the mobile app does not currently expose
  Audit log.

### Items — costs visible only with `VIEW_COSTS`
- `unitHV_COSTS` (`unitCost`/`unitPrice`/`stockValue`) only renders in the item detail
  and the new/edit forms if the user holds `VIEW_COSTS`. Drivers can see item names and
  quantities without seeing what they're worth.

### Mobile-only extras
The mobile app has a few things the web app doesn't: a Dashboard landing screen
(today's revenue, low-stock items, recent activity in one view), a bottom tab bar, OS-
following dark mode, optional Face ID app lock, category filter chips + sort on the items
list, swipe-to-adjust on item rows, and haptic feedback. See
[`mobile/README.md`](mobile/README.md) for details.

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
| Movements CSV | `GET /api/v1/items/export.csv`, `GET /api/v1/items/:id/movements/export.csv` |
| Users | `GET/POST /api/v1/users`, `PATCH /api/v1/users/:id/permissions`, `PATCH /api/v1/users/:id/active`, `POST /api/v1/users/:id/reset-password` |
| Orders | `GET/POST /api/v1/orders`, `GET /api/v1/orders/:id`, `PATCH /api/v1/orders/:id/assign`, `POST /api/v1/orders/:id/out-for-delivery`, `POST /api/v1/orders/:id/deliver`, `POST /api/v1/orders/:id/cancel`, `GET /api/v1/orders/drivers` |
| Account | `PATCH /api/v1/account`, `POST /api/v1/account/password`, `POST /api/v1/me/sessions` (self-revoke) |
| Users (admin) | `POST /api/v1/users/:id/revoke-sessions` (force sign-out everywhere) |
| Activity | `GET /api/v1/activity` (driver-scoped unless caller holds order-management perm) |
| Reports | `GET /api/v1/reports` (`VIEW_REPORTS`) |
| Audit | `GET /api/v1/audit` (`VIEW_AUDIT_LOG`) |

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
├── prisma/                       # schema, migrations, seed script
│   └── migrations/<timestamp>_phase1_permissions_audit/  # Phase 1 schema changes (audit log, tokenVersion, etc.)
├── scripts/
│   └── permissions-migration/    # one-time MANAGE_ORDERS → 3-perm remap (run explicitly after the schema migration)
├── src/
│   ├── app/
│   │   ├── (app)/                  # web app pages (protected by proxy.ts)
│   │   │   ├── items/              # inventory: list, detail, new/edit, service.ts
│   │   │   ├── settings/           # user mgmt + account + audit log tab + users/[id], service.ts
│   │   │   ├── accounts/           # session-revoke (revokeUserSessions), audit service
│   │   │   ├── audit-log/          # listAuditLog / listUserActivity queries (Phase 1)
│   │   │   ├── activity/           # activity calendar page + calendar.ts (pure helpers)
│   │   │   └── reports/            # accounting reports page + reports.ts (pure helpers)
│   │   ├── api/v1/                 # the JSON API — mirrors (app)/ feature-by-feature
│   │   │   ├── audit/                # Phase 1 (GET /audit, VIEW_AUDIT_LOG)
│   │   │   ├── users/:id/revoke-sessions/  # Phase 1 admin force sign-out
│   │   │   └── me/sessions/         # Phase 1 self-revoke (Sign out everywhere)
│   │   └── login/                  # public login page
│   ├── lib/                        # auth (session + bearer JWT), permissions, prisma client,
│   │                                # audit log helper (writeAuditLog), rate-limit, etc.
│   └── generated/prisma/           # generated Prisma client (regenerate after schema changes)
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

**Mobile app:** builds via Expo Go work out of the box for local development (point
`EXPO_PUBLIC_API_BASE_URL` at your deployed web app's URL to run against production
data). Beyond that, the app is **already configured for EAS Build and shipping to
TestFlight** — see [`mobile/README.md`](mobile/README.md#shipping-to-testflight) for the
full build/submit flow, current status, and credential-troubleshooting notes.
