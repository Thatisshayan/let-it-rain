import { describe, it, expect } from "vitest";
import {
  createUserFormSchema,
  updatePermissionsFormSchema,
  changeOwnPasswordFormSchema,
} from "./schemas";

describe("createUserFormSchema", () => {
  it("accepts a valid submission with permissions selected", () => {
    const result = createUserFormSchema.safeParse({
      name: "Allen",
      email: "Allen@Example.com",
      password: "letitrain123",
      permissions: ["ADJUST_STOCK", "EDIT_ITEMS"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("allen@example.com");
      expect(result.data.permissions).toEqual(["ADJUST_STOCK", "EDIT_ITEMS"]);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = createUserFormSchema.safeParse({
      name: "Allen",
      email: "allen@example.com",
      password: "short",
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = createUserFormSchema.safeParse({
      name: "Allen",
      email: "not-an-email",
      password: "letitrain123",
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty permissions array (a fully restricted user)", () => {
    const result = createUserFormSchema.safeParse({
      name: "NoName",
      email: "noname@example.com",
      password: "letitrain123",
      permissions: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("updatePermissionsFormSchema", () => {
  it("rejects an unknown permission key", () => {
    const result = updatePermissionsFormSchema.safeParse({ permissions: ["SUPER_ADMIN"] });
    expect(result.success).toBe(false);
  });
});

describe("changeOwnPasswordFormSchema", () => {
  it("requires a current password", () => {
    const result = changeOwnPasswordFormSchema.safeParse({
      currentPassword: "",
      newPassword: "letitrain123",
    });
    expect(result.success).toBe(false);
  });
});
