import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  (prisma.user.findUnique as any).mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    name: "Ada",
    permissions,
    active: true,
    tokenVersion: 0,
  });
  return new SignJWT({
    userId: "u1",
    email: "a@b.com",
    name: "Ada",
    permissions,
    tokenVersion: 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("GET /api/v1/audit", () => {
  it("returns 403 without VIEW_AUDIT_LOG", async () => {
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/audit", { headers: { authorization: `Bearer ${token}` } })
    );
    expect(res.status).toBe(403);
  });

  it("returns audit entries with VIEW_AUDIT_LOG", async () => {
    (prisma.auditLog.findMany as any).mockResolvedValue([
      {
        id: "a1",
        action: "USER_CREATED",
        detail: "Created user X",
        createdAt: new Date("2026-07-12T10:00:00.000Z"),
        actor: { id: "u1", name: "Ada" },
        targetUser: null,
        order: null,
      },
    ]);
    const token = await tokenFor(["VIEW_AUDIT_LOG"]);
    const res = await GET(
      new Request("http://localhost/api/v1/audit", { headers: { authorization: `Bearer ${token}` } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].action).toBe("USER_CREATED");
    expect(body.entries[0].actor.name).toBe("Ada");
  });
});