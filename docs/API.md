# `/api/v1` API Reference

This is the JSON API that powers the mobile app (and is usable by any other HTTP
client). It lives alongside the Next.js web app — there's nothing separate to deploy or
run; starting the web app (`npm run dev` / a production deployment) automatically serves
these routes too.

## Authentication

Every endpoint except `POST /api/v1/auth/login` requires a `Authorization: Bearer <jwt>`
header. The token is a `jose`-signed JWT (`HS256`, signed with `SESSION_SECRET`, 30-day
expiry) — the exact same token format and secret the web app uses for its session
cookie, just delivered as a header instead of a cookie. `POST /api/v1/auth/login`
returns this token.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJm...
```

The token payload (`SessionPayload`, `src/lib/auth.ts`):

```ts
{ userId: string; email: string; name: string; permissions: string[]; tokenVersion: number }
```

The `permissions`/`name`/`email`/`tokenVersion` claims only identify *which* `userId`
the request is for — `verifyBearerToken` re-fetches that user from the DB on every call
and enforces their **current** `permissions`/`active` status, not whatever was embedded
in the token at login. A permission revoked (or an account deactivated) after the token
was issued takes effect on the very next request, even though the token itself is still
valid for up to 30 days.

The `tokenVersion` claim is a server-controlled counter that's bumped via
`revokeUserSessions` (`src/app/(app)/accounts/service.ts`) whenever an admin (or the user
themselves via "Sign out everywhere" in Account settings) wants to forcibly invalidate
*every* existing session for that user — invoked server-side via
`POST /api/v1/users/:id/revoke-sessions` (admin) or `POST /api/v1/me/sessions` (self).
After the bump, the next request from any of that user's still-valid JWTs fails
`verifyBearerToken` with `401` because the embedded `tokenVersion` no longer matches the
DB's current value, and the client is dropped to the login screen.

Requests without a valid token, or whose user no longer exists / has been deactivated,
get `401 Unauthorized`. Requests from a valid but under-permissioned user get
`403 Forbidden` on endpoints that require a specific permission (see
[Authorization model](../README.md#authorization-model) in the main README for what each
permission grants).

`src/proxy.ts` exempts `/api/v1/*` from the web app's cookie-based redirect-to-login
behavior — each route below does its own `verifyBearerToken` check.

## Permissions in this API

| Permission | Granted by |
|---|---|
| `MANAGE_USERS` | Create / edit users, sign out everywhere for them |
| `DELETE_ITEMS` | Soft-delete an item |
| `EDIT_ITEMS` | Create / edit items |
| `ADJUST_STOCK` | Receive / remove / count-adjust stock |
| `CREATE_ORDERS` | Create orders, see every order |
| `ASSIGN_DRIVERS` | Assign / reassign drivers, see every order |
| `CANCEL_ORDERS` | Cancel orders, see every order |
| `VIEW_REPORTS` | Read accounting reports (revenue, COGS, profit, valuation) |
| `VIEW_AUDIT_LOG` | Read the system audit log |
| `MANAGE_SETTINGS` | (Reserved — for future Settings → App settings tab) |

Own-account operations (`updateOwnProfile`, `changeOwnPassword`, `revokeOwnSessions`)
require only "signed in" — they key on `session.userId` directly rather than a
permission, since no permission should imply "you can manage your own account."

> **Deprecated:** `MANAGE_ORDERS` still exists in the schema/permission enum during the
> post-Phase 1 migration window so production users don't lose access mid-cutover. New
> rights should use `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS`; everything below that
> says "MANAGE_ORDERS" is shorthand for "any one of those three." A follow-up cleanup
> pass will drop the legacy perm.

## Response conventions

- Success responses are `200` (reads, updates) or `201` (creates), returning JSON.
- Errors return `{ "error": "<human-readable message>" }` with an appropriate status
  code:
  - `400` — validation failure (the message is the first Zod issue's message) or a
    business-rule rejection (e.g. the self-protection guards below)
  - `401` — missing or invalid bearer token
  - `403` — valid token, but the user lacks the required permission
  - `404` — resource not found (or soft-deleted)
  - `409` — a stock-adjustment write lost a `SERIALIZABLE` transaction race after all
    retries were exhausted (rare; safe to retry the request)
  - `429` — too many login attempts, either for the same IP+email or from the same IP
    across different emails (see the login endpoint below)

---

## Auth

### `POST /api/v1/auth/login`

No auth required.

**Request:**
```json
{ "email": "admin@letitrain.app", "password": "letitrain123" }
```

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "...", "email": "...", "name": "...", "permissions": ["..."] }
}
```

`401` if the email/password don't match or the user is deactivated (`active: false`).
`429` if either rate-limit bucket is exceeded (`src/lib/login.ts`, `src/lib/rate-limit.ts`
— same limiter the web login form uses, since both call `attemptLogin`):
- more than 10 attempts for the same IP+email combination within a 15-minute window, or
- more than 30 attempts from the same IP (across any emails) within a 15-minute window —
  this catches an attacker spraying guesses across many emails from one IP, which the
  per-email bucket alone wouldn't.

Backed by Upstash Redis when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are
configured (durable, multi-instance safe), otherwise an in-memory Map (single-instance
only; also the fallback if Upstash errors).

### `POST /api/v1/auth/logout`

Requires auth. Stateless — the JWT isn't tracked server-side, so this endpoint doesn't
invalidate anything; it exists for symmetry and so clients have a place to hang future
server-side session revocation if it's ever added. Always returns `200 { "ok": true }`.
The client is responsible for discarding its stored token.

---

## Items

### `GET /api/v1/items`

Requires auth (any signed-in user).

**Query params:** `q` (search by name, case-insensitive substring), `low` (`1` to filter
to `quantity < minStock` only).

**Response `200`:**
```json
{
  "items": [
    {
      "id": "...", "name": "Widget", "category": null,
      "quantity": 28, "minStock": 15,
      "unitCost": 3.5, "unitPrice": 9.99,
      "lowStock": false
    }
  ]
}
```

### `POST /api/v1/items`

Requires `EDIT_ITEMS`.

**Request:**
```json
{
  "name": "Widget", "category": "Hardware", "description": "...",
  "minStock": 5, "initialQuantity": 20,
  "customFields": "color: blue\nsize: M",
  "unitCost": 3.5, "unitPrice": 9.99
}
```
`category`, `description`, `customFields` are optional. `customFields` is a
`"key: value"`-per-line string, parsed into a JSON object. If `initialQuantity > 0`, a
`RECEIVE` movement is created automatically with reason `"Initial stock"`.

**Response `201`:** `{ "itemId": "..." }`

### `GET /api/v1/items/:id`

Requires auth. `404` if the item doesn't exist or is soft-deleted.

**Response `200`:**
```json
{
  "item": {
    "id": "...", "name": "Widget", "category": null, "description": null,
    "quantity": 28, "minStock": 15, "unitCost": 3.5, "unitPrice": 9.99,
    "customFields": { "color": "blue" }
  },
  "movements": [
    {
      "id": "...", "type": "RECEIVE", "delta": 20, "quantityAfter": 20,
      "reason": "Initial stock", "isSale": false,
      "cashAmount": null, "interacAmount": null,
      "createdAt": "2026-07-11T03:11:42.121Z",
      "user": { "name": "Admin" }
    }
  ]
}
```
`movements` is capped at the 20 most recent, newest first.

### `PATCH /api/v1/items/:id`

Requires `EDIT_ITEMS`.

**Request:** same shape as create, minus `initialQuantity` (quantity can only change via
the movements endpoint below):
```json
{ "name": "Widget", "minStock": 10, "unitCost": 3.5, "unitPrice": 9.99 }
```

**Response `200`:** `{ "ok": true }`

### `DELETE /api/v1/items/:id`

Requires `DELETE_ITEMS`. Soft delete — sets `deletedAt`, preserves `Movement` history.

**Response `200`:** `{ "ok": true }`

### `POST /api/v1/items/:id/movements`

Requires `ADJUST_STOCK`. Runs inside a `SERIALIZABLE` transaction with retry-on-conflict
(up to 3 attempts) — see [Notable implementation details](../README.md#notable-implementation-details).

**Request** — one of three shapes depending on `type`:
```json
{ "type": "RECEIVE", "amount": 10, "unitCost": 3.5, "reason": "Restock" }
```
```json
{ "type": "REMOVE", "amount": 2, "cashAmount": 12, "interacAmount": 8, "reason": "Counter sale" }
```
```json
{ "type": "ADJUST", "counted": 25, "reason": "Physical count correction" }
```
`RECEIVE`/`REMOVE` amounts must be positive integers. `ADJUST` takes the *counted*
total quantity, not a delta — the server computes the resulting delta. `cashAmount`/
`interacAmount` on `REMOVE` are both optional (default `0`); the movement is recorded as
a sale (`isSale: true`) whenever their sum is greater than `0` — a plain "shrinkage"
removal just omits both. The server snapshots the *effective* unit price actually paid
(`(cashAmount + interacAmount) / amount`) as `unitPriceAtTime`, not the item's current
list price, so it exactly matches what was collected even if it differs from list price.
`reason` is
optional on all three. `unitCost` on `RECEIVE` updates the item's cost via a
quantity-weighted average if provided; if omitted, the existing cost is kept.

**Response `200`:** `{ "ok": true }`. `400` if the resulting quantity would go negative
or the item doesn't exist; `409` if all serialization retries were exhausted.

### `GET /api/v1/items/export.csv`

Requires auth. Same data as the web app's `/items/export.csv` page, exposed under `/api/v1`
because that page route only checks the session **cookie** (`getSession()`), which mobile
has no equivalent of — this endpoint does the same `Bearer` check as every other `/api/v1`
route instead. **Response `200`:** `text/csv`, one row per non-deleted item (name,
category, quantity, min stock).

### `GET /api/v1/items/:id/movements/export.csv`

Requires auth. Same idea as above, for a single item's full movement history. `404` if the
item doesn't exist. **Response `200`:** `text/csv` (date, type, delta, quantity after,
user, reason).

---

## Orders

Orders model a delivery to a named customer: multiple line items (item + quantity), an
assigned driver, and a status lifecycle
(`PENDING → OUT_FOR_DELIVERY → DELIVERED`, or `→ CANCELLED` from either of the first two).
Order responsibilities are split across three permissions rather than a single
`MANAGE_ORDERS` umbrella (see the deprecation note at the end of this section):

- **`CREATE_ORDERS`** — create orders.
- **`ASSIGN_DRIVERS`** — assign/reassign drivers to orders.
- **`CANCEL_ORDERS`** — cancel orders.
- Any one of those three is also the "see every order" permission: `listOrders` returns
  everything for a `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS` holder, and only the
  caller's own assigned orders otherwise.
- **The order's assigned driver** — can act on *that specific order* (mark it
  out-for-delivery, mark it delivered) without needing any of the three — an ownership
  check (`order.driverId === session.userId`), the same pattern used for own-account
  actions elsewhere in this API. Anyone who is neither gets `403` and, for listing, simply
  doesn't see orders that aren't theirs.

> Deprecation note: the database schema and `permissions` enum in Phase 1 still contain
> the legacy single permission `MANAGE_ORDERS` to make permission migration
> (`scripts/permissions-migration/migrate.ts`) idempotent. New granting should use the
> three finer permissions above. Once the migration has run in production and all users
> have the right combination of the new perms, `MANAGE_ORDERS` can be removed in a
> follow-up cleanup.

### `GET /api/v1/orders`

Requires auth. Returns every order for any of `CREATE_ORDERS`/`ASSIGN_DRIVERS`/
`CANCEL_ORDERS` holders; returns only orders assigned to the caller otherwise.

**Response `200`:**
```json
{
  "orders": [
    {
      "id": "...", "customerName": "Acme Co", "customerAddress": null, "customerPhone": null,
      "status": "PENDING", "notes": null,
      "driver": { "id": "...", "name": "Dana" },
      "lineItems": [{ "id": "...", "itemId": "...", "itemName": "Widget", "quantity": 3 }],
      "createdAt": "2026-07-12T00:00:00.000Z",
      "outForDeliveryAt": null, "deliveredAt": null
    }
  ]
}
```

### `POST /api/v1/orders`

Requires `CREATE_ORDERS`.

**Request:**
```json
{
  "customerName": "Acme Co", "customerAddress": "123 Main St", "customerPhone": "555-0100",
  "notes": "Leave at the back door",
  "lineItems": [{ "itemId": "...", "quantity": 3 }]
}
```
`customerAddress`, `customerPhone`, `notes` are optional. `lineItems` requires at least
one entry; each `itemId` must reference a real, non-deleted item. Stock is **not**
checked or decremented at creation — only at delivery (see below).

**Response `201`:** `{ "orderId": "..." }`

### `GET /api/v1/orders/:id`

Requires auth. `404` if the order doesn't exist, or if the caller doesn't hold any
of `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS` and isn't the assigned driver
(same "not found" response either way, not `403` — avoids confirming an order ID exists
to someone who has no business knowing about it).

**Response `200`:** same shape as a list entry, plus `createdBy: { id, name }`.

### `PATCH /api/v1/orders/:id/assign`

Requires `ASSIGN_DRIVERS`.

**Request:** `{ "driverId": "..." }` or `{ "driverId": null }` to unassign.
`400` if the order is already `DELIVERED` or `CANCELLED`.

**Response `200`:** `{ "ok": true }`

### `POST /api/v1/orders/:id/out-for-delivery`

Requires auth; any of `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS` or the assigned
driver. `400` unless the order is currently `PENDING`.

**Response `200`:** `{ "ok": true }`

### `POST /api/v1/orders/:id/deliver`

Requires auth; any of `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS` or the assigned
driver. Runs inside a `SERIALIZABLE` transaction with retry-on-conflict, same as
`POST /api/v1/items/:id/movements` — creates one `REMOVE` movement per line item,
all-or-nothing (if any single line item can't be fulfilled, e.g. insufficient stock, the
whole delivery is rejected and nothing is written).

**Request:**
```json
{ "payments": [{ "lineItemId": "...", "cashAmount": 12, "interacAmount": 3 }] }
```
`payments` is optional per line item (omit an entry, or send `0`/`0`, for a non-sale
delivery). Whenever a line item's `cashAmount + interacAmount > 0`, its movement is
sale-flagged (`isSale: true`) exactly like a manual stock removal — it snapshots the
effective price paid and flows into `GET /api/v1/reports`'s `monthRevenue`/`monthCash`/
`monthInterac`/`monthCogs` totals automatically, no separate delivery-accounting system.

**Response `200`:** `{ "ok": true }`. `400` if the order isn't currently `PENDING` or
`OUT_FOR_DELIVERY`, or if any line item can't be fulfilled; `409` if all serialization
retries were exhausted.

### `POST /api/v1/orders/:id/cancel`

Requires `CANCEL_ORDERS`. `400` if the order is already `DELIVERED` or `CANCELLED`.
On success the server also stamps `cancelledAt`/`cancelledById` on the row so the
cancellation is audit-traceable.

**Response `200`:** `{ "ok": true }`

### `GET /api/v1/orders/drivers`

Requires `ASSIGN_DRIVERS`. A deliberately minimal endpoint (id/name only, active users
only) for populating a driver-assignment picker — `GET /api/v1/users` requires
`MANAGE_USERS` instead and exposes more than an order manager needs, so this exists
rather than loosening that endpoint's permission or over-exposing user data.

**Response `200`:** `{ "drivers": [{ "id": "...", "name": "Dana" }] }`

---

## Audit

### `GET /api/v1/audit`

Requires `VIEW_AUDIT_LOG`. Returns the most recent writes to the system — every user
create / permission change / activate-deactivate / password-reset / session-revoke and
every order create / driver assign / cancellation, with the actor (who did it), the
target (if a user or order was acted on), a human-readable `detail`, and the timestamp.

**Query params:**
- `page` — 1-indexed page number (default `1`)
- `pageSize` — rows per page, max `200` (default `50`)
- `action` — filter to a single audit action enum (e.g. `USER_CREATED`, `ORDER_CANCELLED`)
- `actorId`, `targetUserId`, `orderId` — filter by the column

**Response `200`:**
```json
{
  "entries": [
    {
      "id": "...",
      "action": "USER_CREATED",
      "detail": "Created user Bob (bob@x.com) with permissions: MANAGE_USERS",
      "createdAt": "2026-07-12T10:00:00.000Z",
      "actor": { "id": "...", "name": "Admin" },
      "targetUser": { "id": "...", "name": "Bob" },
      "order": null
    }
  ]
}
```

---

## Session revocation (Sign out everywhere)

### `POST /api/v1/users/:id/revoke-sessions`

Admin operation. Requires `MANAGE_USERS`. Bumps the target user's `tokenVersion`, so
*every* of that user's currently-valid JWTs (on every device, every browser, the mobile
app — anything holding the token) fails its next request with `401` and is forced back
to the login screen. Useful when a phone is lost, an employee leaves, or a permission
should be effectively revoked everywhere immediately.

No request body. **Response `200`:** `{ "ok": true }`. `403` for non-admins.

### `POST /api/v1/me/sessions`

Self-service. Requires auth (any signed-in user, can only revoke *their own* sessions —
the `:id` is taken from `session.userId`). Same effect as the admin endpoint above, but
caller-side: it powers the "Sign out everywhere" button in Account settings. Always
returns `200`.

### `GET /api/v1/users`

Requires `MANAGE_USERS`.

**Response `200`:**
```json
{
  "users": [
    { "id": "...", "name": "Admin", "email": "admin@letitrain.app", "permissions": ["MANAGE_USERS", "..."], "active": true }
  ]
}
```

### `POST /api/v1/users`

**Request:**
```json
{ "name": "Bob", "email": "bob@x.com", "password": "at-least-8-chars", "permissions": ["EDIT_ITEMS"] }
```

**Response `201`:** `{ "userId": "..." }`. `400` if the email is already in use.

### `PATCH /api/v1/users/:id/permissions`

**Request:** `{ "permissions": ["EDIT_ITEMS", "ADJUST_STOCK"] }`

**Response `200`:** `{ "ok": true }`. `400` with message *"You can't remove your own
ability to manage users."* if `:id` is the caller and the new list omits
`MANAGE_USERS`.

### `PATCH /api/v1/users/:id/active`

**Request:** `{ "active": false }`

**Response `200`:** `{ "ok": true }`. `400` with message *"You can't deactivate your own
account."* if `:id` is the caller and `active` is `false`.

### `POST /api/v1/users/:id/reset-password`

Admin-set password for another user (no current-password check — that's what
distinguishes this from the self-service `/api/v1/account/password` below).

**Request:** `{ "password": "at-least-8-chars" }`

**Response `200`:** `{ "ok": true }`

---

## Account (self-service, requires auth, no specific permission)

### `PATCH /api/v1/account`

Update your own display name.

**Request:** `{ "name": "New Name" }`

**Response `200`:** `{ "ok": true }`

### `POST /api/v1/account/password`

Change your own password. Requires your current password.

**Request:** `{ "currentPassword": "...", "newPassword": "at-least-8-chars" }`

**Response `200`:** `{ "ok": true }`. `400` with message *"Current password is
incorrect."* if `currentPassword` doesn't match.

---

## Activity

### `GET /api/v1/activity`

Requires auth (any signed-in user, no specific permission). Results are scoped per the
calling user's role: anyone holding at least one of `CREATE_ORDERS`/`ASSIGN_DRIVERS`/
`CANCEL_ORDERS` (or `VIEW_AUDIT_LOG`) sees every movement company-wide; drivers and others
without an order-management perm get only the `Movement` rows they themselves authored
(where `Movement.userId === session.userId`). The web `Activity` page enforces the same
rule server-side so a manual URL can't bypass it.

**Query params:** `month` (`YYYY-MM`; defaults to the current month if omitted or
malformed).

**Response `200`:**
```json
{
  "year": 2026, "month": 7, "monthLabel": "July 2026",
  "weeks": [
    [{ "date": "2026-06-28", "inMonth": false }, "... 6 more cells ..."],
    "... more weeks ..."
  ],
  "days": { "2026-07-11": { "net": 15, "count": 2 } },
  "movements": [
    {
      "id": "...", "itemId": "...", "itemName": "Widget",
      "type": "RECEIVE", "delta": 20, "reason": null,
      "userName": "Admin", "createdAt": "2026-07-11T03:11:42.121Z"
    }
  ]
}
```
`weeks` is a Sunday-start month grid, padded with adjacent months' trailing days so
every week has exactly 7 cells (`inMonth: false` for padding days). `days` summarizes
net quantity change and movement count per date (only dates with at least one movement
appear). `movements` is every movement in the requested month, newest first — clients
filter this list by date client-side to show a single day's detail rather than making a
separate request per day.

---

## Reports

### `GET /api/v1/reports`

Requires `VIEW_REPORTS`. (Drivers who only see the "My Deliveries"-style assignment
don't get this endpoint — they get `404`/403 at the API and the web/mobile Reports
screens hide entirely.) The figures returned are sensitive: full revenue, COGS, profit,
cash/Interac split, and inventory valuation across all non-deleted items.

**Query params:** `month` (`YYYY-MM`; defaults to the current month if omitted or
malformed).

**Response `200`:**
```json
{
  "year": 2026, "month": 7, "monthLabel": "July 2026",
  "todayRevenue": 45.0,
  "monthRevenue": 1200.0, "monthCogs": 800.0, "monthProfit": 400.0,
  "monthCash": 700.0, "monthInterac": 500.0,
  "monthRestockCost": 300.0,
  "inventoryValuation": 5400.0,
  "revenueByDay": [{ "date": "2026-07-11", "revenue": 45.0 }],
  "salesByItem": [
    { "itemId": "...", "itemName": "Widget", "unitsSold": 3, "revenue": 45.0, "cogs": 15.0, "profit": 30.0 }
  ]
}
```

- `todayRevenue` is always based on the current calendar day (UTC), independent of the
  `month` param.
- `monthRevenue`/`monthCogs`/`monthProfit` are computed from sale-flagged `REMOVE`
  movements (`isSale: true`) in the requested month, valued at their
  `unitPriceAtTime`/`unitCostAtTime` snapshot — **not** the item's current price/cost —
  so editing an item's price later doesn't retroactively change historical figures.
- `monthCash`/`monthInterac` sum each sale movement's `cashAmount`/`interacAmount`
  directly (independent of `unitPriceAtTime`) — `monthCash + monthInterac` should equal
  `monthRevenue` for the same set of sales.
- `monthRestockCost` sums `delta * unitCostAtTime` across `RECEIVE` movements in the
  requested month.
- `inventoryValuation` is `quantity * unitCost` summed across **all current,
  non-deleted items** (not scoped to the requested month — it's always "right now").
- `revenueByDay` is sorted newest-first. `salesByItem` is sorted by `revenue`
  descending.

---

## Adding a new endpoint

If you're extending this API, follow the existing pattern:

1. Put the actual Prisma logic + permission check in the relevant feature's
   `service.ts` (`src/app/(app)/<feature>/service.ts`), as a plain async function
   taking `(session, ...args)` and returning `{ ok: true, ...data } | { ok: false, error: string }`.
2. Call that function from both the web Server Action and the new
   `src/app/api/v1/<feature>/route.ts` Route Handler — never duplicate the Prisma call
   itself.
3. In the Route Handler: `verifyBearerToken(req)` first (→ `401`), parse the request
   body with the feature's existing Zod schema (→ `400` on failure), call the service
   function, map `result.error` to `403`/`400`/`409` based on its content, otherwise
   return the success shape.
4. Write a Vitest test for the Route Handler mocking `@/lib/prisma`, following the
   pattern in any existing `route.test.ts` file under `src/app/api/v1/`.
5. Update this document and, if the mobile app should use the new endpoint, add a typed
   wrapper in `mobile/src/api/<feature>.ts`.
