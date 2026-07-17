import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    item: { findUnique: vi.fn(), update: vi.fn() },
    movement: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "o1",
            customerName: "Acme",
            status: "OUT_FOR_DELIVERY",
            lineItems: [{ id: "li1", itemId: "i1", quantity: 2 }],
          }),
          update: vi.fn(),
        },
        item: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: "i1", name: "Widget", quantity: 10, unitCost: 1, deletedAt: null }),
          update: vi.fn(),
        },
        movement: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      })
    ),
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
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/v1/orders/:id/deliver", () => {
  it("completes delivery for the assigned driver, with payment", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ id: "o1", driverId: "u2", status: "OUT_FOR_DELIVERY" });
    const token = await tokenFor("u2", []);
    const res = await POST(
      new Request("http://localhost/api/v1/orders/o1/deliver", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ payments: [{ lineItemId: "li1", cashAmount: 10, interacAmount: 0 }] }),
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("rejects an unrelated user without MANAGE_ORDERS", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ id: "o1", driverId: "someone-else", status: "OUT_FOR_DELIVERY" });
    const token = await tokenFor("u3", []);
    const res = await POST(
      new Request("http://localhost/api/v1/orders/o1/deliver", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ payments: [] }),
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(403);
  });
});
