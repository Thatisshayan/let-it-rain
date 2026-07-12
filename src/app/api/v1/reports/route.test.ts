import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    movement: { findMany: vi.fn() },
    item: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function token() {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions: ["VIEW_REPORTS"] })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
  (prisma.user.findUnique as any).mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    name: "Ada",
    permissions: ["VIEW_REPORTS"],
    active: true,
  });
});

describe("GET /api/v1/reports", () => {
  it("returns 401 without a token", async () => {
    const res = await GET(new Request("http://localhost/api/v1/reports"));
    expect(res.status).toBe(401);
  });

  it("returns aggregated figures for the requested month", async () => {
    (prisma.movement.findMany as any)
      .mockResolvedValueOnce([
        {
          id: "m1",
          item: { id: "i1", name: "Widget" },
          delta: -2,
          isSale: true,
          type: "REMOVE",
          unitPriceAtTime: 10,
          unitCostAtTime: 4,
          createdAt: new Date("2026-07-11T12:00:00.000Z"),
        },
        {
          id: "m2",
          item: { id: "i1", name: "Widget" },
          delta: 20,
          isSale: false,
          type: "RECEIVE",
          unitPriceAtTime: null,
          unitCostAtTime: 4,
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          delta: -2,
          unitPriceAtTime: 10,
          createdAt: new Date("2026-07-11T12:00:00.000Z"),
        },
      ]);
    (prisma.item.findMany as any).mockResolvedValue([{ quantity: 10, unitCost: 4 }]);

    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/reports?month=2026-07", {
        headers: { authorization: `Bearer ${t}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2026);
    expect(body.month).toBe(7);
    expect(body.monthRevenue).toBe(20);
    expect(body.monthCogs).toBe(8);
    expect(body.monthProfit).toBe(12);
    expect(body.monthRestockCost).toBe(80);
    expect(body.inventoryValuation).toBe(40);
    expect(body.revenueByDay).toEqual([{ date: "2026-07-11", revenue: 20 }]);
    expect(body.salesByItem).toEqual([
      { itemId: "i1", itemName: "Widget", unitsSold: 2, revenue: 20, cogs: 8, profit: 12 },
    ]);
  });
});
