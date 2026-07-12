import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function token() {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions: [] })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/v1/account/password", () => {
  it("returns 400 when the current password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: [],
      active: true,
      passwordHash: "h",
    });
    (verifyPassword as any).mockResolvedValue(false);
    const t = await token();
    const res = await POST(
      new Request("http://localhost/api/v1/account/password", {
        method: "POST",
        headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: "wrong", newPassword: "newpassword1" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on a valid password change", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: [],
      active: true,
      passwordHash: "h",
    });
    (verifyPassword as any).mockResolvedValue(true);
    const t = await token();
    const res = await POST(
      new Request("http://localhost/api/v1/account/password", {
        method: "POST",
        headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: "right", newPassword: "newpassword1" }),
      })
    );
    expect(res.status).toBe(200);
  });
});
