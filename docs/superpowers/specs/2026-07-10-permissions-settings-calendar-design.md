# Permissions, Settings, Calendar & Hardening — Design

Date: 2026-07-10
Status: Approved

## Scope

Twelve items, grouped by workstream:

1. Per-user granular permissions (replaces the earlier admin/member idea)
2. Settings page → Users tab (create/edit/deactivate users, manage permissions)
3. Settings page → My Account tab (change own name/password)
4. Activity Calendar page (dated movement log, day drill-down)
5. Low-stock query fix (DB-level filter instead of fetch-all-then-filter-in-JS)
6. Movement history pagination ("Load more" instead of a flat `take: 100`)
7. CSV export (inventory snapshot + per-item movement history)
8. Unit tests (vitest) for stock math, permission checks, user validation
9. `next.config.ts` `turbopack.root` fix (silences multi-lockfile warning)

## 1. Data model

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  permissions  String[] @default([MANAGE_USERS, DELETE_ITEMS, EDIT_ITEMS, ADJUST_STOCK])
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  movements Movement[]
}
```

Permission keys (constants in `src/lib/permissions.ts`, not a Prisma enum, so the
set can grow without a migration):

- `MANAGE_USERS` — create users, edit others' permissions, deactivate accounts
- `DELETE_ITEMS` — delete inventory items
- `EDIT_ITEMS` — create/edit items, categories, min-stock
- `ADJUST_STOCK` — receive / remove / adjust quantities

New users default to **all four** permissions granted (matches "Admin, Allen,
Jackson, Anonymous → all permissions" from the brainstorm); an admin then
unchecks specific ones per user (the "NoName → ADJUST_STOCK only" case).

Safety rail: a user can never remove their own `MANAGE_USERS` permission
(prevents total admin lockout with no recovery path). Deactivated users can't
log in; their movement history is kept (same soft-delete philosophy as items).

Migration: `npx prisma migrate dev --name add_user_permissions`.

## 2. Session & permission checks

`SessionPayload` (in `src/lib/auth.ts`) gains `permissions: string[]`. Login
action reads it from the DB user record and bakes it into the JWT, so
permission checks in server actions don't need a DB round-trip:

```ts
// src/lib/permissions.ts
export const PERMISSIONS = ["MANAGE_USERS", "DELETE_ITEMS", "EDIT_ITEMS", "ADJUST_STOCK"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export function hasPermission(session: SessionPayload | null, perm: Permission): boolean {
  return !!session?.permissions?.includes(perm);
}
```

Server actions that need gating (`deleteItemAction`, `createItemAction`,
`updateItemAction`, `adjustStockAction`, the new user-management actions)
call `hasPermission` and return `{ error: "You don't have permission to do that." }`
if it fails — same `ActionState` shape already used everywhere, no new
error-handling pattern introduced. `proxy.ts` is unchanged (it only checks
"is logged in", not per-route permissions — permission checks stay at the
action layer where the DB writes happen, consistent with how auth already
works in this app).

Deactivated users: `proxy.ts`'s JWT check doesn't know about `active` (it's
baked into the token at login time). Add a `active` check on the session
payload itself refreshed on each `getSession()` call would require a DB hit
on every request — instead, deactivation takes effect on next login (the
session is a capability token, same tradeoff the app already accepts for
permissions). Document this in the settings UI ("takes effect next time they
sign in").

## 3. Settings page

`/settings`, tab-based (client component switching between two server-rendered
panels via query param `?tab=users|account`, default `users` if permitted else
`account`).

**Users tab** (gated: redirect to `/settings?tab=account` if the viewer lacks
`MANAGE_USERS`):
- Table: name, email, permission chips, active/inactive badge, "Edit" action.
- "Create user" button → dialog with name/email/password/permission checkboxes
  (all checked by default).
- Edit user → dialog with the same fields (no password field; separate
  "Reset password" action) plus permission checkboxes and a Deactivate/Reactivate
  toggle.
- Server actions: `createUserAction`, `updateUserPermissionsAction`,
  `setUserActiveAction`, `resetUserPasswordAction`.

**My Account tab** (everyone):
- Change name, change password (requires current password).
- Server actions: `updateOwnProfileAction`, `changeOwnPasswordAction`.

Nav: header gets a "Settings" link (gear icon) for everyone.

## 4. Activity Calendar

`/activity`, server component, month grid (`?month=2026-07` query param,
prev/next links compute adjacent months — no client JS needed for navigation).

- Query: all movements in the visible month (`createdAt` between first/last
  day), grouped by local calendar date in JS (small dataset per month, no need
  for a DB-level GROUP BY).
- Each day cell: net units changed that day (sum of `delta`), colored
  green (net positive / received), amber (net negative / removed), gray (no
  activity) — reuses the existing `success`/`warning` design tokens.
- Click a day (link to `/activity?month=...&day=YYYY-MM-DD`) → detail panel
  below the grid listing that day's movements (item, type, delta, user, time),
  same row style as the item detail page's movement history.
- Nav: header gets an "Activity" link.

## 5. Low-stock query fix

Replace the `allMatching` fetch-then-filter-in-JS in `items/page.tsx` with a
`prisma.$queryRaw` that compares `quantity < "minStock"` at the DB level,
wrapped so it still composes with the existing name/category search and
pagination (`LIMIT`/`OFFSET` in the same raw query, `COUNT(*)` for total).
Parameterized via Prisma's tagged-template `$queryRaw` (safe from SQL
injection — no raw string interpolation of user input).

## 6. Movement history pagination

Item detail page: server-rendered first 20 movements + a "Load more" button
that's a client component calling a new server action
(`loadMoreMovementsAction(itemId, cursor)`) returning the next 20 as a cursor
page (`createdAt`+`id` compound cursor for stable ordering with ties).

## 7. CSV export

Two route handlers (`src/app/(app)/items/export.csv/route.ts` and
`src/app/(app)/items/[id]/movements/export.csv/route.ts`), `GET`, returning
`Content-Type: text/csv` with a `Content-Disposition: attachment` header.
Manual CSV serialization (small, fixed column sets — no library needed).
Both require a valid session (same as any other page) but no extra
permission — read-only.

## 8. Tests

New `vitest` unit tests (no DB required — these test pure functions):
- `movement.test.ts` — `computeMovement` (receive/remove/adjust, negative-stock
  guard, adjust-requires-reason-on-variance) — extends existing coverage gap.
- `permissions.test.ts` — `hasPermission` truthy/falsy cases, missing session.
- `schemas.test.ts` — user-creation zod schema (duplicate-shape validation,
  password min length, email format).
- `csv.test.ts` — CSV serialization helper (escaping commas/quotes/newlines).

## 9. Housekeeping

`next.config.ts`:
```ts
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
};
```

## Out of scope (explicitly)

- Email delivery for new-user password reset (no email service configured;
  admin communicates the password out-of-band, as decided in brainstorming).
- Per-route UI hiding beyond what's needed for correctness (server actions are
  the enforcement point; nav links may still show and just error/redirect if
  clicked without permission, matching the app's existing lightweight style).
- Calendar year/agenda views — month view only for v1.
