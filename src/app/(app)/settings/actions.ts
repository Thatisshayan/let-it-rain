"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createUserFormSchema,
  updatePermissionsFormSchema,
  resetPasswordFormSchema,
  updateOwnProfileFormSchema,
  changeOwnPasswordFormSchema,
} from "./schemas";

export type ActionState = {
  error?: string;
  success?: string;
};

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { error: "You don't have permission to manage users." };
  }

  const parsed = createUserFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const { name, email, password, permissions } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "A user with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { name, email, passwordHash, permissions },
  });

  revalidatePath("/settings");
  return { success: `Created ${name}.` };
}

export async function updateUserPermissionsAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { error: "You don't have permission to manage users." };
  }

  const parsed = updatePermissionsFormSchema.safeParse({
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const { permissions } = parsed.data;

  if (userId === session.userId && !permissions.includes("MANAGE_USERS")) {
    return { error: "You can't remove your own ability to manage users." };
  }

  await prisma.user.update({ where: { id: userId }, data: { permissions } });

  revalidatePath("/settings");
  return { success: "Permissions updated." };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { error: "You don't have permission to manage users." };
  }
  if (userId === session.userId && !active) {
    return { error: "You can't deactivate your own account." };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/settings");
  return {};
}

export async function resetUserPasswordAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { error: "You don't have permission to manage users." };
  }

  const parsed = resetPasswordFormSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath("/settings");
  return { success: "Password reset. Share the new password with them directly." };
}

export async function updateOwnProfileAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = updateOwnProfileFormSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  await prisma.user.update({ where: { id: session.userId }, data: { name: parsed.data.name } });

  revalidatePath("/settings");
  return { success: "Profile updated. Sign out and back in to see your new name everywhere." };
}

export async function changeOwnPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = changeOwnPasswordFormSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: session.userId }, data: { passwordHash } });

  return { success: "Password changed." };
}

