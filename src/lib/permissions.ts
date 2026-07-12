export const PERMISSIONS = [
  "MANAGE_USERS",
  "DELETE_ITEMS",
  "EDIT_ITEMS",
  "ADJUST_STOCK",
  "MANAGE_ORDERS",
  "VIEW_REPORTS",
  "VIEW_COSTS",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  MANAGE_USERS: "Manage users",
  DELETE_ITEMS: "Delete items",
  EDIT_ITEMS: "Add / edit items",
  ADJUST_STOCK: "Adjust stock",
  MANAGE_ORDERS: "Manage orders",
  VIEW_REPORTS: "View reports",
  VIEW_COSTS: "View costs & prices",
};

type SessionLike = { permissions?: string[] } | null | undefined;

export function hasPermission(session: SessionLike, perm: Permission): boolean {
  return !!session?.permissions?.includes(perm);
}

export function isValidPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
