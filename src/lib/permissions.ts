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

export const PERMISSION_LABEL: Record<Permission, string> = {
  MANAGE_USERS: "Manage users",
  DELETE_ITEMS: "Delete items",
  EDIT_ITEMS: "Add / edit items",
  ADJUST_STOCK: "Adjust stock",
  CREATE_ORDERS: "Create orders",
  ASSIGN_DRIVERS: "Assign drivers",
  CANCEL_ORDERS: "Cancel orders",
  VIEW_REPORTS: "View reports",
  VIEW_COSTS: "View costs & prices",
  VIEW_AUDIT_LOG: "View audit log",
  MANAGE_SETTINGS: "Manage settings",
};

type SessionLike = { permissions?: string[] } | null | undefined;

export function hasPermission(session: SessionLike, perm: Permission): boolean {
  return !!session?.permissions?.includes(perm);
}

export function isValidPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function canManageOrders(session: SessionLike): boolean {
  return hasPermission(session, "CREATE_ORDERS") || hasPermission(session, "ASSIGN_DRIVERS") || hasPermission(session, "CANCEL_ORDERS");
}
