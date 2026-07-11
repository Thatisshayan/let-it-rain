import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { SessionPayload } from "@/lib/auth";
import type { z } from "zod";
import type {
  createUserFormSchema,
  updatePermissionsFormSchema,
  resetPasswordFormSchema,
  updateOwnProfileFormSchema,
  changeOwnPasswordFormSchema,
} from "./schemas";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, permissions },
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

  await prisma.user.update({ where: { id: userId }, data: { permissions: input.permissions } });
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

  await prisma.user.update({ where: { id: userId }, data: { active } });
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

  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true };
}

export async function updateOwnProfile(
  session: SessionPayload,
  input: UpdateOwnProfileInput
): Promise<Result> {
  await prisma.user.update({ where: { id: session.userId }, data: { name: input.name } });
  return { ok: true };
}

export async function changeOwnPassword(
  session: SessionPayload,
  input: ChangeOwnPasswordInput
): Promise<Result> {
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { ok: false, error: "User not found." };

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: session.userId }, data: { passwordHash } });
  return { ok: true };
}
