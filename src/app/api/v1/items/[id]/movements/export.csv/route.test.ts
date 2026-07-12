import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn() },
    movement: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function token() {
  (prisma.user.findUnique as any).mockResolvedValue({
    id: "u1",
    email: "a@b.com",
    name: "Ada",
    permissions: [],
    active: true,
  });
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

describe("GET /api/v1/items/:id/movements/export.csv", () => {
  it("returns 404 when the item doesn't exist", async () => {
    (prisma.item.findUnique as any).mockResolvedValue(null);
    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/items/i1/movements/export.csv", {
        headers: { authorization: `Bearer ${t}` },
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns CSV of the item's movements", async () => {
    (prisma.item.findUnique as any).mockResolvedValue({ name: "Widget" });
    (prisma.movement.findMany as any).mockResolvedValue([
      {
        createdAt: new Date("2026-07-11T00:00:00.000Z"),
        type: "RECEIVE",
        delta: 10,
        quantityAfter: 10,
        reason: null,
        user: { name: "Admin" },
      },
    ]);
    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/items/i1/movements/export.csv", {
        headers: { authorization: `Bearer ${t}` },
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("RECEIVE");
    expect(body).toContain("Admin");
  });
});
