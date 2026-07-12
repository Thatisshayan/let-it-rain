import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(userId: string, permissions: string[]) {
  (prisma.user.findUnique as any).mockImplementation(async ({ where }: any) => {
    if (where.id === userId) return { id: userId, email: "a@b.com", name: "Ada", permissions, active: true };
    return null;
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

describe("GET /api/v1/orders/:id", () => {
  it("returns 404 when the order doesn't exist", async () => {
    (prisma.order.findUnique as any).mockResolvedValue(null);
    const token = await tokenFor("u1", ["MANAGE_ORDERS"]);
    const res = await GET(
      new Request("http://localhost/api/v1/orders/o1", { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a driver not assigned to this order", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: "o1",
      driverId: "someone-else",
      lineItems: [],
    });
    const token = await tokenFor("u2", []);
    const res = await GET(
      new Request("http://localhost/api/v1/orders/o1", { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns the order for its assigned driver", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: "o1",
      customerName: "Acme",
      customerAddress: null,
      customerPhone: null,
      status: "PENDING",
      notes: null,
      driver: { id: "u2", name: "Driver" },
      createdBy: { id: "u1", name: "Ada" },
      driverId: "u2",
      lineItems: [{ id: "li1", itemId: "i1", quantity: 2, item: { id: "i1", name: "Widget" } }],
      createdAt: new Date(),
      outForDeliveryAt: null,
      deliveredAt: null,
    });
    const token = await tokenFor("u2", []);
    const res = await GET(
      new Request("http://localhost/api/v1/orders/o1", { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order.id).toBe("o1");
    expect(body.order.lineItems[0].itemName).toBe("Widget");
  });
});
