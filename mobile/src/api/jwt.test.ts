import { describe, it, expect } from "vitest";
import { decodeJwtPayload, isTokenExpired } from "./jwt";

function base64UrlEncode(json: unknown): string {
  return Buffer.from(JSON.stringify(json))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeJwt(payload: object): string {
  const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fake-signature`;
}

describe("decodeJwtPayload", () => {
  it("decodes a well-formed token's payload", () => {
    const token = fakeJwt({
      userId: "u1",
      email: "a@b.com",
      name: "Alice",
      permissions: ["EDIT_ITEMS"],
    });

    expect(decodeJwtPayload(token)).toEqual({
      userId: "u1",
      email: "a@b.com",
      name: "Alice",
      permissions: ["EDIT_ITEMS"],
    });
  });

  it("returns null for a malformed token", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("only.two")).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("returns null when the payload segment isn't valid JSON", () => {
    expect(decodeJwtPayload("aGVhZGVy.bm90LWpzb24.sig")).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("returns false when there's no exp claim", () => {
    expect(isTokenExpired({ userId: "u1", email: "a@b.com", name: "A", permissions: [] })).toBe(
      false
    );
  });

  it("returns true for a past exp", () => {
    const pastSeconds = Math.floor(Date.now() / 1000) - 60;
    expect(
      isTokenExpired({
        userId: "u1",
        email: "a@b.com",
        name: "A",
        permissions: [],
        exp: pastSeconds,
      })
    ).toBe(true);
  });

  it("returns false for a future exp", () => {
    const futureSeconds = Math.floor(Date.now() / 1000) + 3600;
    expect(
      isTokenExpired({
        userId: "u1",
        email: "a@b.com",
        name: "A",
        permissions: [],
        exp: futureSeconds,
      })
    ).toBe(false);
  });
});
