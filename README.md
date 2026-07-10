# 🌧️ Let It Rain

A small internal inventory / stock-tracking app. Track items, receive/remove/adjust
stock, and keep a full movement (audit) history per item.

Built with Next.js (App Router), Prisma + PostgreSQL, and shadcn/ui.

## Stack

- **Next.js 16** (App Router, Server Actions, `proxy.ts` route protection)
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter, targeting PostgreSQL
- **jose** for JWT session cookies, **bcryptjs** for password hashing
- **zod** for input validation on all server actions
- **shadcn/ui** + Tailwind v4 for UI
- **vitest** for unit tests

## Getting started

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
   have one.)

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

## Testing

```bash
npm test
```

Unit tests currently cover the stock-movement math (`src/app/(app)/items/movement.ts`)
and custom-field parsing — the two places with real business-logic edge cases.

## Data model

- **User** — an authenticated person. No roles; see [Authorization model](#authorization-model) below.
- **Item** — a tracked inventory item (`quantity`, `minStock`, optional `category`/`customFields`).
  Deletion is a *soft delete* (`deletedAt`): deleted items disappear from every view but their
  `Movement` history is preserved for audit purposes rather than being cascade-deleted.
- **Movement** — an immutable log row created whenever stock is received, removed, or
  count-adjusted. This is the audit trail; it is never edited or deleted directly.

## Authorization model

This app currently has **authentication but no authorization**: any signed-in user can
view, create, edit, delete (soft-delete), and adjust stock on any item. There are no
roles, teams, or per-item ownership.

This is a deliberate choice for the current use case — a single small team sharing one
inventory, where everyone is trusted to manage stock. If this ever needs to support
multiple independent teams/warehouses or restricted roles (e.g. "can adjust stock" vs.
"can delete items"), that needs a real design pass (an `Org`/`Warehouse` scoping model,
or a `role` field on `User` plus permission checks in each server action) — don't bolt
roles onto individual actions ad hoc, as that tends to produce inconsistent enforcement.

## Notable implementation details

- **Concurrency:** stock adjustments (`adjustStockAction`) run inside a `SERIALIZABLE`
  Prisma transaction with retry-on-conflict, so two simultaneous adjustments to the same
  item can't silently overwrite each other (lost update).
- **Rate limiting:** login attempts are limited per IP+email via an in-memory sliding
  window (`src/lib/rate-limit.ts`). This is fine for a single-instance deployment; swap
  for a shared store (e.g. Redis) if this ever runs multiple instances behind a load
  balancer.
- **Low stock:** items with `quantity < minStock` are flagged throughout the UI and
  surfaced as a count badge in the nav bar, linking to a filtered `/items?low=1` view.

## Deploy

The easiest way to deploy is [Vercel](https://vercel.com/new). Make sure `DATABASE_URL`
and `SESSION_SECRET` are set as environment variables, and that migrations have been
applied to the target database before the app receives traffic.
