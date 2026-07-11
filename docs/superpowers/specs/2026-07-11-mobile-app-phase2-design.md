# Mobile App — Phase 2: Settings & User Management (Design)

## Context

Mobile Phase 1 shipped the core inventory workflow (items, movements) as a native app
backed by a new `/api/v1` JSON API, deliberately deferring settings, per-user permission
management, the activity calendar, and accounting reports. This phase picks up the first
of those: settings and user management, so an admin can manage the team (create users,
grant/revoke permissions, deactivate accounts, reset passwords) and any signed-in user
can manage their own name/password, all from the phone.

The web app already has this fully built (`src/app/(app)/settings/`), including the
self-protection rules that stop an admin from locking themselves out (can't remove their
own `MANAGE_USERS` permission, can't deactivate their own account). This phase reuses
that logic rather than re-implementing it, following the same pattern established in
Phase 1: extract Prisma logic into a shared service, expose it over both Server Actions
(web) and new Route Handlers (mobile).

## Goals (Phase 2)

- Admin (`MANAGE_USERS`) can, from the phone: list users, create a user, edit a user's
  permissions, activate/deactivate a user, reset another user's password.
- Any signed-in user can, from the phone: edit their own name, change their own password.
- Same self-protection rules as web: an admin can't strip their own `MANAGE_USERS`
  permission or deactivate their own account.

Out of scope for phase 2: activity calendar, accounting/reports on mobile (later phases).

## Approach

Same shape as Phase 1: extract the Prisma calls currently inline in
`src/app/(app)/settings/actions.ts` into a shared, framework-agnostic service module,
called by both the existing Server Actions (unchanged behavior) and new Route Handlers
under `src/app/api/v1/`. The existing zod schemas in `src/app/(app)/settings/schemas.ts`
(`createUserFormSchema`, `updatePermissionsFormSchema`, `resetPasswordFormSchema`,
`updateOwnProfileFormSchema`, `changeOwnPasswordFormSchema`) and the password helpers in
`src/lib/password.ts` are reused as-is — no changes needed, they're already
framework-agnostic.

### Reusing existing logic

Extract into `src/app/(app)/settings/service.ts`:

- `createUser(session, input)` — permission check, email-uniqueness check, hash password,
  `prisma.user.create`.
- `updateUserPermissions(session, userId, input)` — permission check, the
  "can't remove own MANAGE_USERS" guard, `prisma.user.update`.
- `setUserActive(session, userId, active)` — permission check, the
  "can't deactivate self" guard, `prisma.user.update`.
- `resetUserPassword(session, userId, input)` — permission check, hash password,
  `prisma.user.update`.
- `updateOwnProfile(session, input)` — `prisma.user.update` on own name.
- `changeOwnPassword(session, input)` — verify current password, hash new password,
  `prisma.user.update`.

`actions.ts` is rewritten to call these (same `redirect()`/`revalidatePath()` wrapper
kept), mirroring how `items/actions.ts` was refactored in Phase 1.

### API surface (phase 2)

All routes under `src/app/api/v1/`, same auth (`verifyBearerToken`) and error convention
(`{ error }` JSON, 400/401/403 status codes) as Phase 1.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/users` | `MANAGE_USERS` | list users: id, name, email, permissions, active |
| POST | `/api/v1/users` | `MANAGE_USERS` | create user |
| PATCH | `/api/v1/users/:id/permissions` | `MANAGE_USERS` | update permissions (self-guard applies) |
| PATCH | `/api/v1/users/:id/active` | `MANAGE_USERS` | activate/deactivate (self-guard applies) |
| POST | `/api/v1/users/:id/reset-password` | `MANAGE_USERS` | admin sets a new password for another user |
| PATCH | `/api/v1/account` | any | update own name |
| POST | `/api/v1/account/password` | any | change own password (requires current password) |

### Mobile app structure

- New `Settings` entry point in mobile navigation. Shows "Users" only if the signed-in
  user's `permissions` includes `MANAGE_USERS`; always shows "Account".
- Screens (Expo Router, mirroring Phase 1's conventions):
  - `/settings` — entry point, links to Users (conditional) and Account.
  - `/settings/users` — list of users with active/inactive badge; tap → detail.
  - `/settings/users/:id` — permission checkboxes (four permissions), active toggle,
    "Reset password" action.
  - `/settings/users/new` — create-user form (name, email, password, permissions).
  - `/settings/account` — edit own name, change own password.
- Typed API client functions in `mobile/src/api/settings.ts`, following the same shape
  as `mobile/src/api/items.ts`.
- Self-protection errors (e.g. "You can't remove your own ability to manage users.") are
  enforced server-side only; the mobile screens just display whatever error the API
  returns — no client-side duplication of that logic.

### Error handling

Same conventions as Phase 1: validation errors return 400 with the first zod issue
message; permission failures return 403; the self-protection guards return their existing
web error message unchanged, surfaced inline in the mobile form.

### Testing

- Vitest tests for `settings/service.ts` covering: permission enforcement on every
  function, the two self-protection guards (own `MANAGE_USERS` removal, own
  deactivation), duplicate-email rejection on create, and successful paths — same style
  as `items/service.test.ts`.
- Vitest tests for each new Route Handler covering auth/permission/validation status
  codes, same style as the Phase 1 API route tests.
- Mobile: manual Expo Go verification of the full admin flow (create user, edit
  permissions, deactivate, reset password) and the account flow (edit name, change
  password), consistent with Phase 1's manual verification approach.

## Verification

- `npm test` covers the new service and route handler tests alongside all existing
  suites.
- Manual: with the dev server running, exercise `/api/v1/users` and `/api/v1/account*`
  via curl/Postman using the seeded admin account, confirming the self-protection guards
  return 400/403 as expected before testing on the mobile app.
- Manual: in the mobile app, log in as the seeded admin, create a second user, edit that
  user's permissions, deactivate and reactivate them, reset their password, then confirm
  the changes are visible on the existing web settings page (same database). Also verify
  editing your own name/password from the mobile Account screen.
