import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  (prisma.user.findUnique as any).mockResolvedValue({
    id: "admin-1",
    email: "admin@x.com",
    name: "Admin",
    permissions,
    active: true,
  });
  return new SignJWT({ userId: "admin-1", email: "admin@x.com", name: "Admin", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/v1/users/:id/reset-password", () => {
  it("returns 403 without MANAGE_USERS", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/users/u2/reset-password", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ password: "newpassword1" }),
      }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with MANAGE_USERS", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/users/u2/reset-password", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ password: "newpassword1" }),
      }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(200);
  });
});
