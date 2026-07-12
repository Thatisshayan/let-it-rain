import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "./auth";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long";
});

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(header?: string) {
  return new Request("http://localhost/api/v1/items", {
    headers: header ? { authorization: header } : {},
  });
}

describe("verifyBearerToken", () => {
  it("returns null when there is no Authorization header", async () => {
    expect(await verifyBearerToken(makeRequest())).toBeNull();
  });

  it("returns null for a malformed header", async () => {
    expect(await verifyBearerToken(makeRequest("NotBearer abc"))).toBeNull();
  });

  it("returns null for an invalid token", async () => {
    expect(await verifyBearerToken(makeRequest("Bearer not-a-real-token"))).toBeNull();
  });

  it("returns the session payload, sourced from the current DB row, for a valid token", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      active: true,
      tokenVersion: 0,
    });
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({
      userId: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      tokenVersion: 0,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    const session = await verifyBearerToken(makeRequest(`Bearer ${token}`));
    expect(session).toEqual(
      expect.objectContaining({
        userId: "u1",
        email: "a@b.com",
        name: "Ada",
        permissions: ["EDIT_ITEMS"],
      })
    );
  });

  it("returns null when the token's permissions are stale (DB has since changed them)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: [], // revoked since the token was issued
      active: true,
      tokenVersion: 0,
    });
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({
      userId: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      tokenVersion: 0,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    const session = await verifyBearerToken(makeRequest(`Bearer ${token}`));
    expect(session?.permissions).toEqual([]);
  });

  it("returns null when the user has been deactivated since the token was issued", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      active: false,
      tokenVersion: 0,
    });
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({
      userId: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      tokenVersion: 0,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    expect(await verifyBearerToken(makeRequest(`Bearer ${token}`))).toBeNull();
  });

  it("returns null when the user no longer exists", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({
      userId: "deleted-user",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      tokenVersion: 0,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    expect(await verifyBearerToken(makeRequest(`Bearer ${token}`))).toBeNull();
  });

  it("returns null when tokenVersion has been revoked (sign-out-everywhere)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      active: true,
      tokenVersion: 1, // token was issued with version 0
    });
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({
      userId: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
      tokenVersion: 0,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    expect(await verifyBearerToken(makeRequest(`Bearer ${token}`))).toBeNull();
  });
});
