import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn(), update: vi.fn() },
    movement: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, PATCH, DELETE } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
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

describe("GET /api/v1/items/:id", () => {
  it("returns 404 when the item doesn't exist", async () => {
    (prisma.item.findUnique as any).mockResolvedValue(null);
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/items/i1", { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns the item and its movements", async () => {
    (prisma.item.findUnique as any).mockResolvedValue({
      id: "i1",
      name: "Widget",
      category: null,
      description: null,
      quantity: 3,
      minStock: 5,
      unitCost: 1,
      unitPrice: 2,
      customFields: null,
    });
    (prisma.movement.findMany as any).mockResolvedValue([]);
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/items/i1", { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe("i1");
    expect(body.movements).toEqual([]);
  });
});

describe("DELETE /api/v1/items/:id", () => {
  it("returns 403 without DELETE_ITEMS", async () => {
    const token = await tokenFor([]);
    const res = await DELETE(
      new Request("http://localhost/api/v1/items/i1", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(403);
  });
});
