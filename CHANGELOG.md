# Changelog

This file records verified project milestones. It should not contain speculative work written as if it already shipped.

## 2026-07-17

### Verified changes

- Password reset and password change now increment `tokenVersion`, so existing sessions are invalidated on the next request after a credential change.
- The default `User.permissions` array in `prisma/schema.prisma` now includes `VIEW_AUDIT_LOG` and `MANAGE_SETTINGS`.
- A backfill migration exists to append those two permissions to existing users who are missing them.
- The permissions test suite now checks that the schema default stays aligned with the canonical `PERMISSIONS` list.
- CSV formula-injection hardening landed and is covered by tests.
- Mobile order flows were updated away from the legacy `MANAGE_ORDERS` permission model in the related code paths.
- `README.md`, `STATUS.md`, and `LETITRAINNEXTSPRIN.md` were rewritten to reflect the repo's actual current state.

### Verification

- Root/web tests: `234/234` passing
- Mobile tests: `22/22` passing

## Rule

Only add an entry here when the underlying work has actually been implemented and verified.
