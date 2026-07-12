import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { create: vi.fn(), findMany: vi.fn() },
    item: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

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

describe("GET /api/v1/orders", () => {
  it("returns orders scoped to the caller", async () => {
    (prisma.order.findMany as any).mockResolvedValue([]);
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/orders", { headers: { authorization: `Bearer ${token}` } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toEqual([]);
  });
});

describe("POST /api/v1/orders", () => {
  it("returns 403 without CREATE_ORDERS", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ customerName: "Acme", lineItems: [{ itemId: "i1", quantity: 1 }] }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("creates an order with CREATE_ORDERS", async () => {
    (prisma.item.findMany as any).mockResolvedValue([{ id: "i1" }]);
    (prisma.order.create as any).mockResolvedValue({ id: "o1" });
    const token = await tokenFor(["CREATE_ORDERS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ customerName: "Acme", lineItems: [{ itemId: "i1", quantity: 1 }] }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 with no line items", async () => {
    const token = await tokenFor(["CREATE_ORDERS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ customerName: "Acme", lineItems: [] }),
      })
    );
    expect(res.status).toBe(400);
  });
});
