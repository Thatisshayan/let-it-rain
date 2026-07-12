import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn() },
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
};

const other = {
  userId: "u2",
  email: "u2@x.com",
  name: "Other",
  permissions: [] as string[],
  tokenVersion: 0,
};

beforeEach(() => vi.clearAllMocks());

describe("revokeUserSessions", () => {
  it("self-revoke is always allowed", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const result = await revokeUserSessions(admin, admin.userId);
    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: admin.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("allows admin to revoke another user's sessions", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const result = await revokeUserSessions(admin, other.userId);
    expect(result.ok).toBe(true);
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