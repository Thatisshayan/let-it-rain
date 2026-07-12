import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { item: { findMany: vi.fn() }, user: { findUnique: vi.fn() } },
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

describe("GET /api/v1/items/export.csv", () => {
  it("returns 401 without a token", async () => {
    const res = await GET(new Request("http://localhost/api/v1/items/export.csv"));
    expect(res.status).toBe(401);
  });

  it("returns CSV for an authenticated user", async () => {
    (prisma.item.findMany as any).mockResolvedValue([
      { name: "Widget", category: "Hardware", quantity: 5, minStock: 2 },
    ]);
    const t = await token();
    const res = await GET(
      new Request("http://localhost/api/v1/items/export.csv", {
        headers: { authorization: `Bearer ${t}` },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Widget");
    expect(body).toContain("Name,Category,Quantity,Min stock");
  });
});
