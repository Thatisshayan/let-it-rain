import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(userId: string, permissions: string[]) {
  (prisma.user.findUnique as any).mockResolvedValue({
    id: userId,
    email: "a@b.com",
    name: "Ada",
    permissions,
    active: true,
    organizationId: "org-1",
  });
  return new SignJWT({ userId, email: "a@b.com", name: "Ada", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/v1/orders/:id/out-for-delivery", () => {
  it("allows the assigned driver", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ id: "o1", driverId: "u2", status: "PENDING", customerName: "Acme" });
    (prisma.order.update as any).mockResolvedValue({});
    const token = await tokenFor("u2", []);
    const res = await POST(
      new Request("http://localhost/api/v1/orders/o1/out-for-delivery", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("rejects an unrelated user without MANAGE_ORDERS", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ id: "o1", driverId: "someone-else", status: "PENDING" });
    const token = await tokenFor("u3", []);
    const res = await POST(
      new Request("http://localhost/api/v1/orders/o1/out-for-delivery", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(403);
  });
});
