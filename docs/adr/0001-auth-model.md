# ADR 0001: Authentication & Authorization Model

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
  `{ userId, email, name, permissions }`, signed with `SESSION_SECRET`,
  30-day expiry.
- The JWT's `permissions`/`name`/`email` claims are only used to authenticate
  *that a valid session for `userId` exists* — `getSession()` and
  `verifyBearerToken()` both re-fetch the `User` row by `userId` on every
  call and return the **current** DB permissions/active status, not the
  claims embedded in the token. This closes a stale-authorization gap: with
  a 30-day token lifetime, trusting the embedded permissions would mean a
  revoked permission (or a deactivated account) stayed effective for up to
  30 days or until the user's next login. The tradeoff is one extra
  `User` lookup per authenticated request/page load; if that becomes a
  bottleneck, revisit with a short-TTL cache keyed by `userId` (invalidated
  on any `User.permissions`/`User.active` write) rather than reverting to
  trusting the token's claims outright.
- **Web**: the token is set as an `httpOnly`, `sameSite=lax`, `secure`
  (in prod) cookie (`createSession`/`destroySession`). `src/proxy.ts`
  (Next.js middleware) verifies this cookie for all non-public, non-API
  pages and redirects to `/login` on failure — this protects **pages**,
  not API routes.
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
  `permissions: string[]` embedded in the JWT against a fixed enum
  (`MANAGE_USERS`, `DELETE_ITEMS`, `EDIT_ITEMS`, `ADJUST_STOCK`).
- Permission checks live in **two** places by design:
  1. Route wrapper level (`withPermission("MANAGE_USERS", ...)`) for
     routes that are permission-gated outright (e.g. `GET /api/v1/users`).
  2. Service-function level (`src/app/(app)/items/service.ts`,
     `src/app/(app)/settings/service.ts`) for routes where the same
     service is called from both the web server action and the API route,
     or where the check depends on request body content (e.g.
     `updateUserPermissions` blocking self-removal of `MANAGE_USERS`).
  Service-layer checks are the source of truth — they run regardless of
  caller. Route-layer checks are a fast-path/defense-in-depth, not a
  substitute.
- Own-account actions (`updateOwnProfile`, `changeOwnPassword`) skip
  permission checks entirely and scope directly to `session.userId` —
  no permission implies "can manage self."

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
