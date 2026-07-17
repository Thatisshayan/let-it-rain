import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { hasPermission, isValidPermission, PERMISSIONS } from "./permissions";

describe("PERMISSIONS", () => {
  it("contains the expected keys", () => {
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

  it("matches the default permissions in prisma schema", () => {
    const schemaContent = readFileSync("prisma/schema.prisma", "utf8");
    const permissionsMatch = schemaContent.match(/permissions\s+String\[\]\s+@default\(\[([^\]]+)\]\)/);
    expect(permissionsMatch).toBeTruthy();
    
    if (permissionsMatch) {
      const schemaPermissions = permissionsMatch[1]
        .split(",")
        .map(p => p.trim().replace(/"/g, ""))
        .sort();
      const expectedPermissions = [...PERMISSIONS].sort();
      expect(schemaPermissions).toEqual(expectedPermissions);
    }
  });
});

describe("hasPermission", () => {
  it("returns true when the permission is present", () => {
    expect(hasPermission({ permissions: ["ADJUST_STOCK"] }, "ADJUST_STOCK")).toBe(true);
  });

  it("returns false when the permission is missing", () => {
    expect(hasPermission({ permissions: ["ADJUST_STOCK"] }, "DELETE_ITEMS")).toBe(false);
  });

  it("returns false for a null session", () => {
    expect(hasPermission(null, "MANAGE_USERS")).toBe(false);
  });

  it("returns false for an undefined session", () => {
    expect(hasPermission(undefined, "MANAGE_USERS")).toBe(false);
  });

  it("returns false when permissions is an empty array", () => {
    expect(hasPermission({ permissions: [] }, "MANAGE_USERS")).toBe(false);
  });
});

describe("isValidPermission", () => {
  it("returns true for a known permission key", () => {
    expect(isValidPermission("DELETE_ITEMS")).toBe(true);
  });

  it("returns false for an unknown string", () => {
    expect(isValidPermission("SUPER_ADMIN")).toBe(false);
  });
});
