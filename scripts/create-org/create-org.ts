/**
 * Phase 13c — admin-only organization creation (CLI).
 *
 * Creates a new organization + its first admin user directly against the DB.
 * Admin-only by virtue of requiring server/DB access — not a public flow.
 *
 *   npx tsx scripts/create-org/create-org.ts \
 *     --org "Second Business" \
 *     --name "Owner Name" \
 *     --email owner@second.com \
 *     --password "at-least-8-chars"
 */
import "dotenv/config";
import { createOrganizationWithAdmin } from "../../src/lib/org-provisioning";
import { prisma } from "../../src/lib/prisma";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const orgName = arg("--org");
  const name = arg("--name");
  const email = arg("--email");
  const password = arg("--password");

  if (!orgName || !name || !email || !password) {
    console.error("Usage: --org <name> --name <admin name> --email <admin email> --password <admin password>");
    process.exit(2);
  }

  const res = await createOrganizationWithAdmin({ orgName, admin: { name, email, password } });
  if (!res.ok) {
    console.error("Failed:", res.error);
    process.exit(1);
  }
  console.log(`Created organization ${res.organizationId} with admin ${email} (${res.adminUserId}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
