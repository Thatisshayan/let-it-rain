import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Phase 13c — organization provisioning.
 *
 * Creates a BRAND NEW organization plus its first admin user, atomically. This
 * is the admin-only/invite-based "create a new tenant" flow (PHASE13 §4, 13c) —
 * it is deliberately NOT public self-serve signup (that is gated 13d).
 *
 * Security notes:
 * - This function ALWAYS creates a new Organization. It has no parameter for an
 *   existing org id, so it can never be used to attach an admin to an existing
 *   tenant — that whole attack surface simply doesn't exist here.
 * - The first admin is granted the full permission set so the new tenant is
 *   immediately self-managing.
 * - email is globally unique (Phase 13b decision); creation fails cleanly if the
 *   admin email already belongs to any user in any org.
 */
export type ProvisionInput = {
  orgName: string;
  admin: { name: string; email: string; password: string };
  /** Optional starting values for the org's AppConfig. */
  settings?: { businessName?: string; defaultLowStock?: number };
};

export type ProvisionResult =
  | { ok: true; organizationId: string; adminUserId: string }
  | { ok: false; error: string };

export async function createOrganizationWithAdmin(input: ProvisionInput): Promise<ProvisionResult> {
  const email = input.admin.email.trim().toLowerCase();
  const orgName = input.orgName.trim();
  const adminName = input.admin.name.trim();

  if (!orgName) return { ok: false, error: "Organization name is required." };
  if (!adminName) return { ok: false, error: "Admin name is required." };
  if (!email) return { ok: false, error: "Admin email is required." };
  if (input.admin.password.length < 8) return { ok: false, error: "Admin password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "A user with that email already exists." };

  const passwordHash = await hashPassword(input.admin.password);

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: orgName } });
    const admin = await tx.user.create({
      data: {
        organizationId: org.id,
        name: adminName,
        email,
        passwordHash,
        // First admin gets every permission so the tenant is self-sufficient.
        permissions: [...PERMISSIONS],
      },
    });
    await tx.appConfig.create({
      data: {
        organizationId: org.id,
        businessName: input.settings?.businessName ?? orgName,
        defaultLowStock: input.settings?.defaultLowStock ?? 0,
      },
    });
    return { organizationId: org.id, adminUserId: admin.id };
  });

  return { ok: true, ...result };
}
