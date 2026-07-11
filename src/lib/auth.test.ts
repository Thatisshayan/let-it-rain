import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { verifyBearerToken } from "./auth";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long";
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

  it("returns the session payload for a valid token", async () => {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({
      userId: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
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
});
