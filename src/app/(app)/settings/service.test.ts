import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createUser,
  updateUserPermissions,
  setUserActive,
  resetUserPassword,
  updateOwnProfile,
  changeOwnPassword,
} from "./service";

const admin = {
  userId: "admin-1",
  email: "admin@x.com",
  name: "Admin",
  permissions: ["MANAGE_USERS"],
  tokenVersion: 0,
  organizationId: "org-a",
};

beforeEach(() => vi.clearAllMocks());

describe("createUser", () => {
  it("rejects without MANAGE_USERS", async () => {
    const result = await createUser(
      { ...admin, permissions: [] },
      { name: "Bob", email: "bob@x.com", password: "password1", permissions: [] }
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });
    const result = await createUser(admin, {
      name: "Bob",
      email: "bob@x.com",
      password: "password1",
      permissions: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already exists/);
  });

  it("creates a user with a hashed password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u2" });
    const result = await createUser(admin, {
      name: "Bob",
      email: "bob@x.com",
      password: "password1",
      permissions: ["EDIT_ITEMS"],
    });
    expect(result.ok).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith("password1");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: "Bob",
        email: "bob@x.com",
        passwordHash: "hashed:password1",
        permissions: ["EDIT_ITEMS"],
        organizationId: "org-a",
      },
    });
  });
});

describe("updateUserPermissions", () => {
  it("rejects without MANAGE_USERS", async () => {
    const result = await updateUserPermissions({ ...admin, permissions: [] }, "u2", { permissions: [] });
    expect(result.ok).toBe(false);
  });

  it("blocks removing your own MANAGE_USERS permission", async () => {
    const result = await updateUserPermissions(admin, "admin-1", { permissions: ["EDIT_ITEMS"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/remove your own/);
  });

  it("allows updating someone else's permissions", async () => {
    // Org-scoped lookup now precedes the update; mock it as an in-org user.
    (prisma.user.findUnique as any).mockResolvedValue({ name: "Bob", email: "bob@x.com", permissions: [] });
    (prisma.user.update as any).mockResolvedValue({});
    const result = await updateUserPermissions(admin, "u2", { permissions: ["EDIT_ITEMS"] });
    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u2", organizationId: "org-a" },
      data: { permissions: ["EDIT_ITEMS"] },
    });
  });

  it("treats an out-of-org target as not found", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const result = await updateUserPermissions(admin, "other-org-user", { permissions: ["EDIT_ITEMS"] });
    expect(result.ok).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("setUserActive", () => {
  it("blocks deactivating yourself", async () => {
    const result = await setUserActive(admin, "admin-1", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/deactivate your own/);
  });

  it("allows deactivating someone else", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ name: "Bob", email: "bob@x.com", active: true });
    (prisma.user.update as any).mockResolvedValue({});
    const result = await setUserActive(admin, "u2", false);
    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u2", organizationId: "org-a" },
      data: { active: false },
    });
  });
});

describe("resetUserPassword", () => {
  it("rejects without MANAGE_USERS", async () => {
    const result = await resetUserPassword({ ...admin, permissions: [] }, "u2", { password: "newpassword1" });
    expect(result.ok).toBe(false);
  });

  it("hashes and sets the new password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ name: "Bob", email: "bob@x.com" });
    (prisma.user.update as any).mockResolvedValue({});
    const result = await resetUserPassword(admin, "u2", { password: "newpassword1" });
    expect(result.ok).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith("newpassword1");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u2", organizationId: "org-a" },
      data: { passwordHash: "hashed:newpassword1" },
    });
  });
});

describe("updateOwnProfile", () => {
  it("updates the caller's own name", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const result = await updateOwnProfile(admin, { name: "New Name" });
    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "admin-1", organizationId: "org-a" },
      data: { name: "New Name" },
    });
  });
});

describe("changeOwnPassword", () => {
  it("rejects when current password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "admin-1", passwordHash: "h" });
    (verifyPassword as any).mockResolvedValue(false);
    const result = await changeOwnPassword(admin, { currentPassword: "wrong", newPassword: "newpassword1" });
    expect(result.ok).toBe(false);
  });

  it("updates the password when current password is correct", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "admin-1", passwordHash: "h" });
    (verifyPassword as any).mockResolvedValue(true);
    (prisma.user.update as any).mockResolvedValue({});
    const result = await changeOwnPassword(admin, { currentPassword: "right", newPassword: "newpassword1" });
    expect(result.ok).toBe(true);
  });
});
