import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "admin-1", email: "admin@x.com", name: "Admin", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("GET /api/v1/users", () => {
  it("returns 403 without MANAGE_USERS", async () => {
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/users", { headers: { authorization: `Bearer ${token}` } })
    );
    expect(res.status).toBe(403);
  });

  it("returns users with MANAGE_USERS", async () => {
    (prisma.user.findMany as any).mockResolvedValue([
      { id: "u1", name: "Ada", email: "ada@x.com", permissions: ["EDIT_ITEMS"], active: true },
    ]);
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await GET(
      new Request("http://localhost/api/v1/users", { headers: { authorization: `Bearer ${token}` } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
  });
});

describe("POST /api/v1/users", () => {
  it("returns 403 without MANAGE_USERS", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/users", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Bob", email: "bob@x.com", password: "password1", permissions: [] }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("creates a user with MANAGE_USERS", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u2" });
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/users", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Bob", email: "bob@x.com", password: "password1", permissions: [] }),
      })
    );
    expect(res.status).toBe(201);
  });
});
