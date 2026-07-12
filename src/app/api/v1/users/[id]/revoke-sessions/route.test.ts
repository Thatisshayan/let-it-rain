import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

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

describe("POST /api/v1/users/:id/revoke-sessions", () => {
  it("returns 401 without a token", async () => {
    const res = await POST(
      new Request("http://localhost/api/v1/users/u1/revoke-sessions", { method: "POST" }),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("self-revoke succeeds (always allowed)", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/users/u1/revoke-sessions", { method: "POST", headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects admin revoke of another user without MANAGE_USERS", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/users/u2/revoke-sessions", { method: "POST", headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(403);
  });

  it("allows admin revoke of another user with MANAGE_USERS", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/users/u2/revoke-sessions", { method: "POST", headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(200);
  });
});