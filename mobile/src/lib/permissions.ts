export const PERMISSIONS = [
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

export type Permission = (typeof PERMISSIONS)[number];

type SessionLike = { permissions?: string[] } | null | undefined;

export function hasPermission(user: SessionLike, permission: Permission): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

export function canManageOrders(user: SessionLike): boolean {
  return (
    hasPermission(user, "CREATE_ORDERS") ||
    hasPermission(user, "ASSIGN_DRIVERS") ||
    hasPermission(user, "CANCEL_ORDERS")
  );
}
