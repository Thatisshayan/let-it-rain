/**
 * Phase 1 permission migration: split legacy MANAGE_ORDERS into the three
 * new permissions CREATE_ORDERS, ASSIGN_DRIVERS, CANCEL_ORDERS.
 *
 * Run once on each existing DB right after the phase1-foundational migration:
 *   npx tsx scripts/permissions-migration/migrate.ts
 *
 * - Idempotent: if MANAGE_ORDERS is already absent (or all three new perms
 *   are present), the user is left alone.
 * - Leaves MANAGE_ORDERS in place for now so a rollback doesn't immediately
 *   strip permissions; will be removed in a follow-up phase once we're
 *   confident. If a user shouldn't have any of the three new perms but
 *   currently has MANAGE_ORDERS, give them all three (same effective
 *   permissions under both models), then revisit manually.
 */
import { prisma } from "../../src/lib/prisma";

const LEGACY = "MANAGE_ORDERS";
const NEW_PERMISSIONS = ["CREATE_ORDERS", "ASSIGN_DRIVERS", "CANCEL_ORDERS"] as const;

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, permissions: true },
  });

  let migrated = 0;
  let skipped = 0;
  for (const user of users) {
    const perms = new Set(user.permissions);
    if (!perms.has(LEGACY)) {
      skipped++;
      continue;
    }
    for (const p of NEW_PERMISSIONS) perms.add(p);
    perms.delete(LEGACY);
    await prisma.user.update({
      where: { id: user.id },
      data: { permissions: [...perms] },
    });
    migrated++;
    console.log(`migrated: ${user.email} (${user.id})`);
  }

  console.log(`\nDone. Migrated: ${migrated}, skipped: ${skipped}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());