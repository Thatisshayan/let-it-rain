import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn(), update: vi.fn() },
    movement: { create: vi.fn() },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        item: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: "i1", quantity: 5, unitCost: 1, unitPrice: 2, deletedAt: null }),
          update: vi.fn(),
        },
        movement: { create: vi.fn() },
      })
    ),
  },
}));

import { POST } from "./route";

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

describe("POST /api/v1/items/:id/movements", () => {
  it("returns 403 without ADJUST_STOCK", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/items/i1/movements", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ type: "RECEIVE", amount: 5 }),
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 for a valid RECEIVE with ADJUST_STOCK", async () => {
    const token = await tokenFor(["ADJUST_STOCK"]);
    const res = await POST(
      new Request("http://localhost/api/v1/items/i1/movements", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ type: "RECEIVE", amount: 5 }),
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid movement input", async () => {
    const token = await tokenFor(["ADJUST_STOCK"]);
    const res = await POST(
      new Request("http://localhost/api/v1/items/i1/movements", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ type: "RECEIVE", amount: -5 }),
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(400);
  });
});
