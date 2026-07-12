# ADR 0001: Authentication & Authorization Model

> **Note (post-Phase 1, 2026-07-12):** this ADR predates Phase 1. The shipped model
> adds a `tokenVersion` claim to the JWT for administrative session revocation
> (`revokeUserSessions` / "Sign out everywhere"), splits the legacy single
> `MANAGE_ORDERS` permission into `CREATE_ORDERS`/`ASSIGN_DRIVERS`/`CANCEL_ORDERS`,
> adds `VIEW_REPORTS`/`VIEW_COSTS`/`VIEW_AUDIT_LOG`/`MANAGE_SETTINGS`, and wires every
> write-path through `src/lib/audit.ts` (`writeAuditLog`) so every state mutation is
> recorded in `AuditLog`. The architectural decision documented below (single JWT, two
> transports; DB-backed claim verification on every call) is unchanged — Phase 1 just
> added `tokenVersion` to that pipeline. See the
> [Phase 1 completion report](../LETITRAINNEXTSPRIN.md#phase-1--completion-report-2026-07-12)
> for the diff.

## Status

Accepted

## Context

`letitrain` has two clients — a Next.js web app (session-cookie based) and an
Expo/React Native mobile app (bearer-token based) — sharing one Postgres
database and one REST API surface at `/api/v1/*`. Both need the same identity
and permission model without duplicating business rules.

## Decision

**Single JWT, two transports.**

- `signSessionToken()` (`src/lib/auth.ts`) issues one HS256 JWT containing
  `{ userId, email, name, permissions, tokenVersion }`, signed with `SESSION_SECRET`,
  30-day expiry.
- The JWT's `permissions`/`name`/`email`/`tokenVersion` claims are only used to
  authenticate *that a valid session for `userId` exists* — `getSession()` and
  `verifyBearerToken()` both re-fetch the `User` row by `userId` on every call
  and return the **current** DB `permissions`/`active`/`tokenVersion` status, not the
  claims embedded in the token. This closes two stale-authorization gaps at once:
  with a 30-day token lifetime, trusting the embedded permissions would mean a
  revoked permission (or a deactivated account) stayed effective for up to 30 days or
  until the user's next login; without `tokenVersion`, even after deactivation and
  re-enabling a deleted JWT would still pass verification until its 30-day expiry.
  Both are now closed (revoke-and-permissions-changes take effect on the next request;
  logout-everywhere-style revocation works regardless of token expiry). The tradeoff is
  one extra `User` lookup per authenticated request/page load; if that becomes a
  bottleneck, revisit with a short-TTL cache keyed by `userId` (invalidated on any
  `User.permissions`/`User.active`/`User.tokenVersion` write) rather than reverting to
  trusting the token's claims outright.
- **Web**: the token is set as an `httpOnly`, `sameSite=lax`, `secure`
  (in prod) cookie (`createSession`/`destroySession`). `src/proxy.ts`
  (Next.js Edge middleware) does a **signature/expiry-only** check of this
  cookie for all non-public, non-API pages and redirects to `/login` on
  failure — this is a fast path, not the authoritative check, and it
  protects **pages**, not API routes. It deliberately does *not* re-fetch
  the user from the DB (Edge middleware can't use the Node-only `pg` driver
  `@/lib/prisma` depends on, and a DB round-trip on every request here would
  be wasteful): the authoritative, DB-backed check is `getSession()`
  (see above), called by `(app)/layout.tsx` and every Server Action, which
  redirects/rejects independently even if `src/proxy.ts` let the request
  through. The cookie name and HS256 signing key are shared between
  `src/lib/auth.ts` and `src/proxy.ts` via `src/lib/session-token.ts` — a
  small module with no `next/headers`/`prisma` dependency, kept edge-safe on
  purpose, so both runtimes import one source of truth instead of
  duplicating the constants.
- **Mobile / API**: the same JWT is returned from
  `POST /api/v1/auth/login` as a bearer token, stored client-side by the
  Expo app, and sent as `Authorization: Bearer <token>` on every request.
- `src/proxy.ts` explicitly bypasses `/api/v1/*` (see `PUBLIC_PATHS` /
  the `pathname.startsWith("/api/v1")` check). **Every `/api/v1` route is
  therefore individually responsible for calling `verifyBearerToken`.**
  This is enforced structurally via `withAuth` / `withPermission`
  (`src/lib/api-auth.ts`) — every route handler is wrapped rather than
  hand-rolling the check, so a new route cannot ship unauthenticated by
  omission.

**Two-layer permission enforcement.**

- `hasPermission(session, perm)` (`src/lib/permissions.ts`) checks the
  `permissions: string[]` embedded in the JWT against the fixed enum `MANAGE_USERS`,
  `DELETE_ITEMS`, `EDIT_ITEMS`, `ADJUST_STOCK`, `CREATE_ORDERS`, `ASSIGN_DRIVERS`,
  `CANCEL_ORDERS`, `VIEW_REPORTS`, `VIEW_COSTS`, `VIEW_AUDIT_LOG`, `MANAGE_SETTINGS`.
  (The legacy `MANAGE_ORDERS` perm still exists during the Phase 1 migration window
  as a superset of the three order perms; new granting should always use the three
  finer-grained perms and `MANAGE_ORDERS` will be removed in a follow-up cleanup.)
- Permission checks live in **three** places by design (the read and write layers are
  separated cleanly):
  1. Route wrapper or page level (`withPermission("MANAGE_USERS", ...)`,
     `hasPermission(session, perm)` in a page render) for routes / pages that are
     permission-gated outright (e.g. `GET /api/v1/users`, the web `/reports` page).
  2. Service-function level (`src/app/(app)/items/service.ts`,
     `src/app/(app)/settings/service.ts`, `src/app/(app)/orders/service.ts`) for
     routes where the same service is called from both the web server action and the
     API route, or where the check depends on request body content (e.g.
     `updateUserPermissions` blocking self-removal of `MANAGE_USERS`).
  3. Audit layer (`src/lib/audit.ts` → `writeAuditLog`) records every mutation
     (user create/permission change/activate/deactivate/session-revoke, order
     create/assign/cancel, and future settings/AI actions) into `AuditLog` with actor,
     target, detail, and timestamp — so what the permission model gates is also auditable
     after the fact.
  Service-layer checks are the source of truth — they run regardless of caller. Route
  / page-level checks are a fast-path/defense-in-depth, not a substitute.
- Own-account actions (`updateOwnProfile`, `changeOwnPassword`,
  `revokeOwnSessions`) skip permission checks entirely and scope directly to
  `session.userId` — no permission implies "can manage self."

**Rate limiting is best-effort, not an authZ boundary.**

- Login attempts are throttled by `checkRateLimit` (`src/lib/rate-limit.ts`),
  keyed by `ip:email` (10 attempts / 15 min) **and** a coarser `ip`-only key
  (30 attempts / 15 min). The per-email key alone let an attacker spray
  guesses across many different emails from one IP without ever tripping a
  shared limit; the IP-only key closes that gap while still allowing normal
  shared-IP scenarios (offices, NAT) some headroom. It uses Upstash Redis when
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are configured
  (durable, multi-instance safe), falling back to an in-memory Map
  otherwise (or on Upstash error) — correct for a single instance, but
  silently non-durable across replicas without Upstash configured.
- Client IP is read from `x-vercel-forwarded-for` (trusted, since Vercel's
  edge overwrites it) with a fallback to the first hop of
  `x-forwarded-for` — untrusted/spoofable on non-Vercel hosts unless that
  proxy strips client-supplied values. This is acceptable because it only
  gates a rate limit, not authentication itself.

## Consequences

- Adding a new `/api/v1` route **must** go through `withAuth`/`withPermission`
  — there is no middleware-level fallback protecting API routes.
- Any new mutating service function must independently check permissions;
  don't assume the calling route already did (routes and server actions
  both call into services).
- If this app is ever deployed off Vercel, revisit the IP-trust assumption
  in `getClientIp` (`src/lib/login.ts`) and confirm the reverse proxy
  strips client-supplied `x-forwarded-for`.
- If deployed multi-instance without configuring Upstash, login rate
  limiting silently degrades to per-instance (not global) enforcement.
