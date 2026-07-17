import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";
import { PLANS, seatLimitReached } from "@/lib/plans";
import type { SessionPayload } from "@/lib/auth";
import type { z } from "zod";
import type {
  createUserFormSchema,
  updatePermissionsFormSchema,
  resetPasswordFormSchema,
  updateOwnProfileFormSchema,
  changeOwnPasswordFormSchema,
  orgSettingsFormSchema,
} from "./schemas";
import { writeAuditLogTx } from "@/lib/audit";

type OrgSettingsInput = z.infer<typeof orgSettingsFormSchema>;
type CreateUserInput = z.infer<typeof createUserFormSchema>;
type UpdatePermissionsInput = z.infer<typeof updatePermissionsFormSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordFormSchema>;
type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileFormSchema>;
type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordFormSchema>;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function createUser(
  session: SessionPayload,
  input: CreateUserInput
): Promise<Result<{ userId: string }>> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }

  const { name, email, password, permissions } = input;

  // email is GLOBALLY unique across the product, so this existence check is
  // intentionally org-agnostic (a given email can exist in at most one org).
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists." };
  }

  // Phase 13d: enforce the org's plan seat limit (counts active users only, so
  // deactivating a user frees a seat). Org-scoped, so one tenant's headcount
  // can't affect another's.
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { plan: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };
  const activeSeats = await prisma.user.count({
    where: { organizationId: session.organizationId, active: true },
  });
  if (seatLimitReached(org.plan, activeSeats)) {
    return {
      ok: false,
      error: `Your ${PLANS[org.plan].label} plan is at its seat limit. Upgrade or deactivate a user to add more.`,
    };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      // New users are created in the acting admin's org — never a client-supplied one.
      data: { name, email, passwordHash, permissions, organizationId: session.organizationId },
    });

    await writeAuditLogTx(tx, {
      actor: session,
      action: "USER_CREATED",
      targetUserId: createdUser.id,
      detail: `Created user ${name} (${email}) with permissions: ${permissions.join(", ")}`,
    });

    return createdUser;
  });

  return { ok: true, userId: user.id };
}

export async function updateUserPermissions(
  session: SessionPayload,
  userId: string,
  input: UpdatePermissionsInput
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }

  if (userId === session.userId && !input.permissions.includes("MANAGE_USERS")) {
    return { ok: false, error: "You can't remove your own ability to manage users." };
  }

  // Org-scoped: an admin can only manage users within their own org.
  const oldUser = await prisma.user.findUnique({ where: { id: userId, organizationId: session.organizationId }, select: { name: true, email: true, permissions: true } });
  if (!oldUser) return { ok: false, error: "User not found." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId, organizationId: session.organizationId }, data: { permissions: input.permissions } });

    await writeAuditLogTx(tx, {
      actor: session,
      action: "USER_PERMISSIONS_CHANGED",
      targetUserId: userId,
      detail: `Updated permissions for ${oldUser?.name} (${oldUser?.email}): ${oldUser?.permissions.join(", ")} -> ${input.permissions.join(", ")}`,
    });
  });

  return { ok: true };
}

export async function setUserActive(
  session: SessionPayload,
  userId: string,
  active: boolean
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }
  if (userId === session.userId && !active) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  const oldUser = await prisma.user.findUnique({ where: { id: userId, organizationId: session.organizationId }, select: { name: true, email: true, active: true } });
  if (!oldUser) return { ok: false, error: "User not found." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId, organizationId: session.organizationId }, data: { active } });

    await writeAuditLogTx(tx, {
      actor: session,
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      targetUserId: userId,
      detail: `${active ? "Activated" : "Deactivated"} user ${oldUser?.name} (${oldUser?.email})`,
    });
  });

  return { ok: true };
}

export async function resetUserPassword(
  session: SessionPayload,
  userId: string,
  input: ResetPasswordInput
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }

  // Look up (org-scoped) and guard BEFORE writing, so a cross-org target is a
  // clean "not found" rather than a thrown update.
  const targetUser = await prisma.user.findUnique({ where: { id: userId, organizationId: session.organizationId }, select: { name: true, email: true } });
  if (!targetUser) return { ok: false, error: "User not found." };

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId, organizationId: session.organizationId }, data: { passwordHash, tokenVersion: { increment: 1 } } });

    await writeAuditLogTx(tx, {
      actor: session,
      action: "USER_PASSWORD_RESET",
      targetUserId: userId,
      detail: `Reset password for ${targetUser?.name} (${targetUser?.email})`,
    });
  });

  return { ok: true };
}

export async function updateOwnProfile(
  session: SessionPayload,
  input: UpdateOwnProfileInput
): Promise<Result> {
  await prisma.user.update({ where: { id: session.userId, organizationId: session.organizationId }, data: { name: input.name } });
  return { ok: true };
}

// Phase 13c: org-level settings (AppConfig is one row per org). All access is
// scoped to session.organizationId, so an org can only ever read/write its own.

export type OrgSettings = { businessName: string | null; defaultLowStock: number };

export async function getOrgSettings(session: SessionPayload): Promise<OrgSettings> {
  const config = await prisma.appConfig.findUnique({
    where: { organizationId: session.organizationId },
    select: { businessName: true, defaultLowStock: true },
  });
  return { businessName: config?.businessName ?? null, defaultLowStock: config?.defaultLowStock ?? 0 };
}

export async function updateOrgSettings(
  session: SessionPayload,
  input: OrgSettingsInput
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_SETTINGS")) {
    return { ok: false, error: "You don't have permission to manage settings." };
  }

  // Upsert keyed on the org — creates the row if this org somehow has none yet
  // (e.g. the original tenant whose AppConfig predates provisioning), always
  // scoped so it can never touch another org's config.
  await prisma.$transaction(async (tx) => {
    await tx.appConfig.upsert({
      where: { organizationId: session.organizationId },
      update: { businessName: input.businessName, defaultLowStock: input.defaultLowStock },
      create: {
        organizationId: session.organizationId,
        businessName: input.businessName,
        defaultLowStock: input.defaultLowStock,
      },
    });

    await writeAuditLogTx(tx, {
      actor: session,
      action: "SETTINGS_CHANGED",
      detail: `Updated org settings (businessName=${input.businessName ?? "—"}, defaultLowStock=${input.defaultLowStock})`,
    });
  });

  return { ok: true };
}

export async function changeOwnPassword(
  session: SessionPayload,
  input: ChangeOwnPasswordInput
): Promise<Result> {
  const user = await prisma.user.findUnique({ where: { id: session.userId, organizationId: session.organizationId } });
  if (!user) return { ok: false, error: "User not found." };

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: session.userId, organizationId: session.organizationId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
  return { ok: true };
}
