import { apiFetch } from "./client";
import { PERMISSIONS } from "../lib/permissions";

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

export async function revokeOwnSessions(): Promise<{ ok: true }> {
  return apiFetch("/api/v1/me/sessions", { method: "POST" });
}

// Phase 13c/13d: org-level settings + plan/billing.
export type OrgSettings = { businessName: string | null; defaultLowStock: number };

export async function fetchOrgSettings(): Promise<OrgSettings> {
  const { settings } = await apiFetch<{ settings: OrgSettings }>("/api/v1/org/settings");
  return settings;
}

export async function updateOrgSettings(input: OrgSettings): Promise<{ ok: true }> {
  return apiFetch("/api/v1/org/settings", { method: "PATCH", body: JSON.stringify(input) });
}

export type OrgInfo = {
  name: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  planLabel: string;
  seatLimit: number | null;
  subscriptionStatus: "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  emailVerified: boolean;
  usage: { activeUsers: number };
};

export async function fetchOrgInfo(): Promise<OrgInfo> {
  const { organization } = await apiFetch<{ organization: OrgInfo }>("/api/v1/org");
  return organization;
}

/** Returns a Stripe Checkout URL to open in the system browser to upgrade. */
export async function startCheckout(plan: "PRO" | "ENTERPRISE"): Promise<{ url: string }> {
  return apiFetch("/api/v1/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) });
}

export const ALL_PERMISSIONS = PERMISSIONS;
