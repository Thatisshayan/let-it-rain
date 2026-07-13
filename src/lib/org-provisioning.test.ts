import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(async (p: string) => `h:${p}`) }));

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { createOrganizationWithAdmin } from "./org-provisioning";

function txMock() {
  const tx = {
    organization: { create: vi.fn().mockResolvedValue({ id: "org-new" }) },
    user: { create: vi.fn().mockResolvedValue({ id: "admin-new" }) },
    appConfig: { create: vi.fn().mockResolvedValue({ id: "cfg-new" }) },
  };
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));
  return tx;
}

beforeEach(() => vi.clearAllMocks());

describe("createOrganizationWithAdmin", () => {
  it("creates a new org, a full-permission admin, and an AppConfig — atomically", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const tx = txMock();

    const res = await createOrganizationWithAdmin({
      orgName: "Second Co",
      admin: { name: "Owner", email: "Owner@Second.com", password: "password1" },
    });

    expect(res).toEqual({ ok: true, organizationId: "org-new", adminUserId: "admin-new" });
    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: "Second Co" } });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-new",
        email: "owner@second.com", // normalized
        permissions: [...PERMISSIONS], // first admin gets everything
      }),
    });
    expect(tx.appConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org-new" }),
    });
  });

  it("rejects a duplicate email without opening a transaction", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });
    const res = await createOrganizationWithAdmin({
      orgName: "X",
      admin: { name: "A", email: "dupe@x.com", password: "password1" },
    });
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a too-short password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await createOrganizationWithAdmin({
      orgName: "X",
      admin: { name: "A", email: "a@x.com", password: "short" },
    });
    expect(res.ok).toBe(false);
  });

  it("has no parameter to target an existing org (can only ever create a new one)", async () => {
    // Structural guarantee: the input shape carries orgName + admin only, never
    // an existing organizationId, so 'attach admin to existing org' is impossible.
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const tx = txMock();
    await createOrganizationWithAdmin({ orgName: "New", admin: { name: "A", email: "a@x.com", password: "password1" } });
    expect(tx.organization.create).toHaveBeenCalledTimes(1); // always a fresh org
  });
});
