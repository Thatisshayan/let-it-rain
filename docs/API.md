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
{ userId: string; email: string; name: string; permissions: string[] }
```

Requests without a valid token get `401 Unauthorized`. Requests from a valid but
under-permissioned user get `403 Forbidden` on endpoints that require a specific
permission (see [Authorization model](../README.md#authorization-model) in the main
README for what each permission grants).

`src/proxy.ts` exempts `/api/v1/*` from the web app's cookie-based redirect-to-login
behavior — each route below does its own `verifyBearerToken` check.

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
  - `429` — too many login attempts for the same IP+email (see the login endpoint below)

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
`429` if there have been more than 10 attempts for the same IP+email combination within
a 15-minute window (`src/lib/rate-limit.ts`, an in-memory sliding window — same limiter
the web login form uses).

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
{ "type": "REMOVE", "amount": 2, "isSale": true, "reason": "Counter sale" }
```
```json
{ "type": "ADJUST", "counted": 25, "reason": "Physical count correction" }
```
`RECEIVE`/`REMOVE` amounts must be positive integers. `ADJUST` takes the *counted*
total quantity, not a delta — the server computes the resulting delta. `reason` is
optional on all three. `unitCost` on `RECEIVE` updates the item's cost via a
quantity-weighted average if provided; if omitted, the existing cost is kept.

**Response `200`:** `{ "ok": true }`. `400` if the resulting quantity would go negative
or the item doesn't exist; `409` if all serialization retries were exhausted.

---

## Users (requires `MANAGE_USERS` unless noted)

### `GET /api/v1/users`

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

Requires auth (any signed-in user, no specific permission).

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

Requires auth (any signed-in user, no specific permission).

**Query params:** `month` (`YYYY-MM`; defaults to the current month if omitted or
malformed).

**Response `200`:**
```json
{
  "year": 2026, "month": 7, "monthLabel": "July 2026",
  "todayRevenue": 45.0,
  "monthRevenue": 1200.0, "monthCogs": 800.0, "monthProfit": 400.0,
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
