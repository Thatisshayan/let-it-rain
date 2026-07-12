import { apiFetch } from "./client";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  permissions: string[];
  active: boolean;
};

export async function fetchUsers(): Promise<UserRow[]> {
  const { users } = await apiFetch<{ users: UserRow[] }>("/api/v1/users");
  return users;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  permissions: string[];
}): Promise<{ userId: string }> {
  return apiFetch("/api/v1/users", { method: "POST", body: JSON.stringify(input) });
}

export async function updateUserPermissions(id: string, permissions: string[]): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/users/${id}/permissions`, {
    method: "PATCH",
    body: JSON.stringify({ permissions }),
  });
}

export async function setUserActive(id: string, active: boolean): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/users/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) });
}

export async function resetUserPassword(id: string, password: string): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function updateOwnProfile(name: string): Promise<{ ok: true }> {
  return apiFetch("/api/v1/account", { method: "PATCH", body: JSON.stringify({ name }) });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return apiFetch("/api/v1/account/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export const ALL_PERMISSIONS = [
  "MANAGE_USERS",
  "DELETE_ITEMS",
  "EDIT_ITEMS",
  "ADJUST_STOCK",
  "CREATE_ORDERS",
  "ASSIGN_DRIVERS",
  "CANCEL_ORDERS",
  "VIEW_REPORTS",
  "VIEW_COSTS",
  "VIEW_AUDIT_LOG",
  "MANAGE_SETTINGS",
] as const;
