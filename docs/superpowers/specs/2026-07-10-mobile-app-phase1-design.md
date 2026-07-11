# Mobile App — Phase 1: Core Inventory (Design)

## Context

Let It Rain is currently a Next.js web app used on a warehouse/desktop basis. The team
wants a native mobile app so staff can manage inventory (look up items, receive/remove/
adjust stock) from a phone, not just a browser. The web app doesn't expose a JSON API —
almost everything runs through Next.js Server Actions bound to cookie sessions, which
React Native can't call directly. A companion API is needed either way, so this is being
treated as its own project rather than bolted onto the web app.

Because the web app has grown to cover items, movements, low-stock, per-user permissions,
settings, an activity calendar, and lean accounting/reporting, building 1:1 parity for
mobile in one pass would be a large, risky change. This phase deliberately covers only the
core inventory workflow — the thing people actually need standing in front of shelves.
Settings, permissions management, the activity calendar, and accounting reports are
explicitly deferred to later phases with their own specs.

## Goals (Phase 1)

- Sign in on a phone using the same credentials as the web app.
- Browse/search items, see low-stock items.
- View an item's detail and its movement (audit) history.
- Receive / remove / adjust stock from a phone.
- Create and edit items.

Out of scope for phase 1: settings, per-user permission management UI, activity calendar,
accounting dashboards/reports, offline support, push notifications, app-store submission.

## Approach

Two coordinated pieces, both living in this repo:

1. A versioned JSON API (`/api/v1/...`) added to the existing Next.js app, reusing current
   business logic, validation, and permission checks rather than duplicating them.
2. A new Expo (React Native + TypeScript) app in `/mobile` that consumes that API.

### Why a real API instead of an alternative

- **Server Actions as-is**: not callable from React Native (no cookie jar, POST-with-
  RSC-payload contract). Rejected.
- **tRPC**: nicer type-sharing long-term, but adds new infra/build complexity for a small
  internal app just to get phase 1 shipped. Deferred — can be revisited if/when more
  clients appear.
- **Plain Next.js Route Handlers returning JSON** (chosen): minimal new infrastructure,
  same framework/deploy target, straightforward to reuse existing Prisma/zod/permission
  code.

### Auth

- `POST /api/v1/auth/login` — validates email/password with the existing bcrypt check,
  returns the same `jose`-signed JWT (same `SessionPayload`: `userId`, `email`, `name`,
  `permissions`) as a JSON body instead of a `Set-Cookie` header. Same `SESSION_SECRET`,
  same 30-day expiry.
- `POST /api/v1/auth/logout` — no server-side state to clear (JWT is stateless); mobile
  just discards the stored token. Endpoint exists for symmetry/future-proofing (e.g. token
  denylist) but does no work today.
- New `verifyBearerToken(req)` helper in `src/lib/auth.ts`, parallel to the existing
  `getSession()`, reading `Authorization: Bearer <token>` and verifying with `jwtVerify`
  using the same secret. Existing `hasPermission(session, permission)` works unchanged
  against the decoded payload.
- Mobile stores the token in `expo-secure-store` and attaches it as a Bearer header on
  every request via a shared API client.

### API surface (phase 1)

All routes live under `src/app/api/v1/`. Response shape on error is `{ error: string }`
with an appropriate status code (400 validation, 401 no/invalid token, 403 missing
permission, 404 not found, 409 serialization conflict on stock adjustment retries
exhausted) — mirroring the existing `ActionState` error convention used by web forms.

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | — | returns `{ token, user }` |
| POST | `/api/v1/auth/logout` | any | no-op, 200 |
| GET | `/api/v1/items` | any | supports `?q=` search, `?low=1` filter, same as `/items` page |
| GET | `/api/v1/items/:id` | any | item + its movements (paginated later if needed; not in phase 1) |
| POST | `/api/v1/items` | `EDIT_ITEMS` | create item (+ initial stock movement if `initialQuantity > 0`) |
| PATCH | `/api/v1/items/:id` | `EDIT_ITEMS` | edit item fields |
| DELETE | `/api/v1/items/:id` | `DELETE_ITEMS` | soft delete (`deletedAt`) |
| POST | `/api/v1/items/:id/movements` | `ADJUST_STOCK` | receive/remove/adjust; same `SERIALIZABLE` transaction + retry-on-conflict as `adjustStockAction` |

### Reusing existing logic

The current `actions.ts` files inline validation + Prisma calls per Server Action. To
avoid duplicating this for the API, extract the core, framework-agnostic pieces into
plain functions that both the Server Action and the new Route Handler call:

- `createItemFormSchema` / `itemFormSchema` / `movementFormSchema` (`src/app/(app)/items/schemas.ts`)
  — already framework-agnostic zod schemas; reused as-is, fed from `FormData` on web and
  parsed JSON on the API.
- `computeMovement` / `nextWeightedAverageCost` (`src/app/(app)/items/movement.ts`) —
  already pure functions; reused as-is.
- New: extract the item-create, item-update, item-delete, and stock-adjustment Prisma
  logic (currently inline in `src/app/(app)/items/actions.ts` and
  `src/app/(app)/items/[id]/actions.ts`) into shared functions (e.g.
  `src/app/(app)/items/service.ts`) that take already-validated input + `session` and
  return a discriminated result. Both the Server Action and the Route Handler call these;
  the Server Action keeps its `redirect()`/`revalidatePath()` wrapper, the Route Handler
  wraps the same result as JSON.

### Mobile app structure

- Expo + Expo Router (file-based routing, familiar coming from Next.js App Router),
  TypeScript, React Query for data fetching/caching/mutations against the API.
- Screens: Login → Items list (search box, low-stock badge/filter) → Item detail
  (fields + movement history list) → Adjust Stock (receive/remove/adjust form) →
  New/Edit Item form.
- Shared typed API client (`mobile/src/api/`) wrapping `fetch`, attaching the bearer
  token, and typed request/response shapes matching the Route Handlers' zod schemas.
- No offline queueing in phase 1: mutations that fail due to no connectivity show a
  retryable error; no local cache beyond React Query's in-memory cache.
- Dev/test loop: Expo Go on a personal device pointed at a local or deployed API URL
  (configurable via `.env`/`app.config.ts`). No EAS Build / TestFlight / app-store
  submission in this phase.

### Error handling

- API: zod validation errors return 400 with the first issue message (same
  `firstIssueMessage` pattern already used); permission failures return 403 with a
  human-readable message; the existing serialization-retry loop for stock adjustments is
  preserved, returning 409 only if all retries are exhausted.
- Mobile: React Query error states rendered inline near the relevant form/list; a failed
  login shows a field-level error; a failed stock adjustment keeps the user on the form
  with their input intact and shows the server's error message.

### Testing

- API: Vitest tests for the new Route Handlers, extending the existing
  `movement.test.ts` / `schemas.test.ts` coverage up to the HTTP layer — auth required,
  permission enforcement, validation errors, and the successful create/edit/delete/adjust
  paths, including the concurrent-adjustment retry behavior.
- Mobile: manual testing via Expo Go against the dev API for this phase; no automated
  mobile tests yet, since the app is a thin client over the already-tested API/business
  logic.

## Verification

- `npm test` covers the new API route handlers and continues to pass existing
  `movement.test.ts`/`schemas.test.ts` suites.
- Manual: run `npm run dev`, log in via `POST /api/v1/auth/login` with curl/Postman using
  seeded credentials, confirm a bearer token is returned and works against
  `GET /api/v1/items`.
- Manual: run the Expo app via `npx expo start`, open in Expo Go pointed at the local API,
  walk through login → items list → item detail → adjust stock → confirm the change is
  reflected both in the app and in the existing web UI (same database).
