import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "o1",
            customerName: "Acme",
            status: "PENDING",
          }),
          update: vi.fn(),
        },
        auditLog: { create: vi.fn() },
      })
    ),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

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

describe("POST /api/v1/orders/:id/cancel", () => {
  it("returns 403 without CANCEL_ORDERS", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/orders/o1/cancel", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("cancels with CANCEL_ORDERS", async () => {
    const token = await tokenFor(["CANCEL_ORDERS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/orders/o1/cancel", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: "o1" }) }
    );
    expect(res.status).toBe(200);
  });
});
