import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Phase 13a: the single existing tenant. This literal UUID matches the one in
// the backfill migration and lives ONLY in the migration/seed layer — never in
// application logic (Phase 13b grep rule).
const LET_IT_RAIN_ORG_ID = "11111111-1111-1111-1111-111111111111";

async function main() {
  // Ensure the default org exists (idempotent) so seeded users have a tenant.
  await prisma.organization.upsert({
    where: { id: LET_IT_RAIN_ORG_ID },
    update: {},
    create: { id: LET_IT_RAIN_ORG_ID, name: "Let It Rain" },
  });

  const users = [
    { name: "Admin", email: "admin@letitrain.app", password: "letitrain123" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash, organizationId: LET_IT_RAIN_ORG_ID },
    });
    console.log(`Seeded user: ${u.email} / ${u.password} (all permissions granted)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
