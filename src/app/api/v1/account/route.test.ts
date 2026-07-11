import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

import { PATCH } from "./route";

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

describe("PATCH /api/v1/account", () => {
  it("returns 401 without a token", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/v1/account", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 for a valid name update", async () => {
    const t = await token();
    const res = await PATCH(
      new Request("http://localhost/api/v1/account", {
        method: "PATCH",
        headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for an empty name", async () => {
    const t = await token();
    const res = await PATCH(
      new Request("http://localhost/api/v1/account", {
        method: "PATCH",
        headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
