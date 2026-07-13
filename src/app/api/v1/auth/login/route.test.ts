import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long";
});

function req(body: unknown) {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/auth/login", () => {
  it("returns 400 for invalid input", async () => {
    const res = await POST(req({ email: "not-an-email", password: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when the user doesn't exist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(req({ email: "a@b.com", password: "secret123" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      passwordHash: "hash",
      permissions: [],
      active: true,
    });
    (bcrypt.compare as any).mockResolvedValue(false);
    const res = await POST(req({ email: "a@b.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns a token and user on success", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Ada",
      passwordHash: "hash",
      permissions: ["EDIT_ITEMS"],
      active: true,
      tokenVersion: 0,
      organizationId: "org-a",
    });
    (bcrypt.compare as any).mockResolvedValue(true);
    const res = await POST(req({ email: "a@b.com", password: "secret123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    // Phase 13a: login resolves and returns the user's org context.
    expect(body.user).toEqual(
      expect.objectContaining({ id: "u1", email: "a@b.com", name: "Ada", permissions: ["EDIT_ITEMS"], organizationId: "org-a" })
    );
  });

  it("returns 429 after too many attempts for the same IP+email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const email = "ratelimit-test@b.com";
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await POST(req({ email, password: "wrong" }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("returns 429 after too many attempts from the same IP across different emails", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      const res = await POST(req({ email: `spray-${i}@b.com`, password: "wrong" }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
