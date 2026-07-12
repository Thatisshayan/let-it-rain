import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn(), findUnique: vi.fn() },
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
  });
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("GET /api/v1/orders/drivers", () => {
  it("returns 403 without ASSIGN_DRIVERS", async () => {
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/orders/drivers", { headers: { authorization: `Bearer ${token}` } })
    );
    expect(res.status).toBe(403);
  });

  it("returns active users with ASSIGN_DRIVERS", async () => {
    (prisma.user.findMany as any).mockResolvedValue([{ id: "u2", name: "Driver" }]);
    const token = await tokenFor(["ASSIGN_DRIVERS"]);
    const res = await GET(
      new Request("http://localhost/api/v1/orders/drivers", { headers: { authorization: `Bearer ${token}` } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drivers).toEqual([{ id: "u2", name: "Driver" }]);
  });
});
