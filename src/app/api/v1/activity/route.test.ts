import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { movement: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

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

describe("GET /api/v1/activity", () => {
  it("returns 401 without a token", async () => {
    const res = await GET(new Request("http://localhost/api/v1/activity"));
    expect(res.status).toBe(401);
  });

  it("returns the requested month's grid, day summaries, and movements", async () => {
    (prisma.movement.findMany as any).mockResolvedValue([
      {
        id: "m1",
        itemId: "i1",
        item: { id: "i1", name: "Widget" },
        type: "RECEIVE",
        delta: 10,
        reason: null,
        user: { name: "Admin" },
        createdAt: new Date("2026-07-11T03:12:29.893Z"),
      },
    ]);
    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/activity?month=2026-07", {
        headers: { authorization: `Bearer ${t}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2026);
    expect(body.month).toBe(7);
    expect(body.weeks.length).toBeGreaterThan(0);
    expect(body.days["2026-07-11"]).toEqual({ net: 10, count: 1 });
    expect(body.movements).toHaveLength(1);
    expect(body.movements[0]).toEqual(
      expect.objectContaining({ id: "m1", itemId: "i1", itemName: "Widget", type: "RECEIVE", delta: 10 })
    );
  });

  it("defaults to the current month when month is omitted", async () => {
    (prisma.movement.findMany as any).mockResolvedValue([]);
    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/activity", { headers: { authorization: `Bearer ${t}` } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toEqual(expect.any(Number));
    expect(body.month).toEqual(expect.any(Number));
  });
});
