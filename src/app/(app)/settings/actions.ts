"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  createUserFormSchema,
  updatePermissionsFormSchema,
  resetPasswordFormSchema,
  updateOwnProfileFormSchema,
  changeOwnPasswordFormSchema,
  orgSettingsFormSchema,
} from "./schemas";
import {
  createUser,
  updateUserPermissions,
  setUserActive,
  resetUserPassword,
  updateOwnProfile,
  changeOwnPassword,
  updateOrgSettings,
} from "./service";

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

  const parsed = createUserFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await createUser(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: `Created ${parsed.data.name}.` };
}

export async function updateUserPermissionsAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = updatePermissionsFormSchema.safeParse({
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await updateUserPermissions(session, userId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: "Permissions updated." };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await setUserActive(session, userId, active);
  if (!result.ok) return { error: result.error };

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

  const parsed = resetPasswordFormSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await resetUserPassword(session, userId, parsed.data);
  if (!result.ok) return { error: result.error };

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

  const result = await updateOwnProfile(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: "Profile updated. Sign out and back in to see your new name everywhere." };
}

export async function updateOrgSettingsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = orgSettingsFormSchema.safeParse({
    businessName: formData.get("businessName"),
    defaultLowStock: formData.get("defaultLowStock"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await updateOrgSettings(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: "Organization settings saved." };
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

  const result = await changeOwnPassword(session, parsed.data);
  if (!result.ok) return { error: result.error };

  return { success: "Password changed." };
}
