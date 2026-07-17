import { describe, expect, it } from "vitest";

import { PERMISSIONS, canManageOrders, hasPermission } from "./permissions";

describe("mobile permissions", () => {
  it("matches the current canonical permission list", () => {
    expect(PERMISSIONS).toEqual([
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
    ]);
  });

  it("does not include the legacy MANAGE_ORDERS permission", () => {
    expect(PERMISSIONS).not.toContain("MANAGE_ORDERS");
  });

  it("treats any split order permission as order-management access", () => {
    expect(canManageOrders({ permissions: ["CREATE_ORDERS"] })).toBe(true);
    expect(canManageOrders({ permissions: ["ASSIGN_DRIVERS"] })).toBe(true);
    expect(canManageOrders({ permissions: ["CANCEL_ORDERS"] })).toBe(true);
    expect(canManageOrders({ permissions: ["VIEW_REPORTS"] })).toBe(false);
    expect(hasPermission({ permissions: ["MANAGE_USERS"] }, "MANAGE_USERS")).toBe(true);
  });
});
