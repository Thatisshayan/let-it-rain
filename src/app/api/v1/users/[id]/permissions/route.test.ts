import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  (prisma.user.findUnique as any).mockResolvedValue({
    id: "admin-1",
    email: "admin@x.com",
    name: "Admin",
    permissions,
    active: true,
    organizationId: "org-a",
  });
  return new SignJWT({ userId: "admin-1", email: "admin@x.com", name: "Admin", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
  process.env.SESSION_SECRET = SECRET;
});

describe("PATCH /api/v1/users/:id/permissions", () => {
  it("returns 400 when removing your own MANAGE_USERS permission", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/users/admin-1/permissions", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ permissions: ["EDIT_ITEMS"] }),
      }),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 for updating someone else's permissions", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/users/u2/permissions", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ permissions: ["EDIT_ITEMS"] }),
      }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(200);
  });
});
