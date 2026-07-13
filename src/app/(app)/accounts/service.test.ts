import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { revokeUserSessions } from "./service";

const admin = {
  userId: "admin-1",
  email: "admin@x.com",
  name: "Admin",
  permissions: ["MANAGE_USERS"],
  tokenVersion: 0,
  organizationId: "org-a",
};

const other = {
  userId: "u2",
  email: "u2@x.com",
  name: "Other",
  permissions: [] as string[],
  tokenVersion: 0,
  organizationId: "org-a",
};

beforeEach(() => vi.clearAllMocks());

describe("revokeUserSessions", () => {
  it("self-revoke is always allowed", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: admin.userId });
    (prisma.user.update as any).mockResolvedValue({});
    const result = await revokeUserSessions(admin, admin.userId);
    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: admin.userId, organizationId: "org-a" },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("allows admin to revoke another user's sessions", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: other.userId });
    (prisma.user.update as any).mockResolvedValue({});
    const result = await revokeUserSessions(admin, other.userId);
    expect(result.ok).toBe(true);
  });

  it("treats an out-of-org target as not found", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const result = await revokeUserSessions(admin, "other-org-user");
    expect(result.ok).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks non-admin user from revoking another user's sessions", async () => {
    const result = await revokeUserSessions(other, admin.userId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/don't have permission/i);
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});