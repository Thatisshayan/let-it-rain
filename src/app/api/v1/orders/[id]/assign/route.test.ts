import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

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

describe("PATCH /api/v1/orders/:id/assign", () => {
  it("returns 403 without ASSIGN_DRIVERS", async () => {
    const token = await tokenFor([]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/orders/o1/assign", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ driverId: "u2" }),
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("assigns a driver with ASSIGN_DRIVERS", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ id: "o1", status: "PENDING" });
    (prisma.order.update as any).mockResolvedValue({});
    const token = await tokenFor(["ASSIGN_DRIVERS"]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/orders/o1/assign", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ driverId: "u2" }),
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(200);
  });
});
