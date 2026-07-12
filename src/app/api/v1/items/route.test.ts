import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findMany: vi.fn(), create: vi.fn() },
    movement: { create: vi.fn() },
    user: { findUnique: vi.fn() },
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

describe("GET /api/v1/items", () => {
  it("returns 401 without a token", async () => {
    const res = await GET(new Request("http://localhost/api/v1/items"));
    expect(res.status).toBe(401);
  });

  it("returns items for an authenticated user", async () => {
    (prisma.item.findMany as any).mockResolvedValue([
      { id: "i1", name: "Widget", category: null, quantity: 3, minStock: 5, unitCost: 1, unitPrice: 2 },
    ]);
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/items", {
        headers: { authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /api/v1/items", () => {
  it("returns 403 without EDIT_ITEMS permission", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/items", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Widget" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("creates an item with EDIT_ITEMS permission", async () => {
    (prisma.item.create as any).mockResolvedValue({ id: "i1" });
    const token = await tokenFor(["EDIT_ITEMS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/items", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Widget" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.itemId).toBe("i1");
  });
});
