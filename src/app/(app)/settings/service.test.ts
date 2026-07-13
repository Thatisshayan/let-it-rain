import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    organization: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    appConfig: { findUnique: vi.fn(), upsert: vi.fn() },
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
  getOrgSettings,
  updateOrgSettings,
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

  it("rejects when the org is at its plan seat limit", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.organization.findUnique as any).mockResolvedValue({ plan: "FREE" }); // seat limit 3
    (prisma.user.count as any).mockResolvedValue(3);
    const result = await createUser(admin, { name: "Bob", email: "bob@x.com", password: "password1", permissions: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/seat limit/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("allows creation under the seat limit", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.organization.findUnique as any).mockResolvedValue({ plan: "FREE" });
    (prisma.user.count as any).mockResolvedValue(2); // 2 < 3
    (prisma.user.create as any).mockResolvedValue({ id: "u9" });
    const result = await createUser(admin, { name: "Bob", email: "bob@x.com", password: "password1", permissions: [] });
    expect(result.ok).toBe(true);
  });

  it("creates a user with a hashed password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.organization.findUnique as any).mockResolvedValue({ plan: "ENTERPRISE" });
    (prisma.user.count as any).mockResolvedValue(2);
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

describe("org settings", () => {
  it("getOrgSettings reads the caller's org config, scoped by org", async () => {
    (prisma.appConfig.findUnique as any).mockResolvedValue({ businessName: "Alpha", defaultLowStock: 7 });
    const res = await getOrgSettings(admin);
    expect(res).toEqual({ businessName: "Alpha", defaultLowStock: 7 });
    expect(prisma.appConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-a" } })
    );
  });

  it("getOrgSettings falls back to defaults when no config row exists", async () => {
    (prisma.appConfig.findUnique as any).mockResolvedValue(null);
    const res = await getOrgSettings(admin);
    expect(res).toEqual({ businessName: null, defaultLowStock: 0 });
  });

  it("updateOrgSettings rejects without MANAGE_SETTINGS", async () => {
    const res = await updateOrgSettings({ ...admin, permissions: [] }, { businessName: "X", defaultLowStock: 1 });
    expect(res.ok).toBe(false);
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled();
  });

  it("updateOrgSettings upserts scoped to the caller's org", async () => {
    (prisma.appConfig.upsert as any).mockResolvedValue({});
    const res = await updateOrgSettings({ ...admin, permissions: ["MANAGE_SETTINGS"] }, { businessName: "New", defaultLowStock: 3 });
    expect(res.ok).toBe(true);
    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-a" },
        update: { businessName: "New", defaultLowStock: 3 },
        create: expect.objectContaining({ organizationId: "org-a" }),
      })
    );
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
