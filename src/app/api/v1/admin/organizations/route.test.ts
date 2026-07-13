import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/org-provisioning", () => ({
  createOrganizationWithAdmin: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { organization: { findMany: vi.fn() } } }));

import { createOrganizationWithAdmin } from "@/lib/org-provisioning";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

function req(body: unknown, token?: string) {
  return new Request("http://localhost/api/v1/admin/organizations", {
    method: "POST",
    headers: token ? { "x-platform-admin-token": token } : {},
    body: JSON.stringify(body),
  });
}

function getReq(token?: string) {
  return new Request("http://localhost/api/v1/admin/organizations", {
    method: "GET",
    headers: token ? { "x-platform-admin-token": token } : {},
  });
}

const validBody = {
  orgName: "Second Co",
  admin: { name: "Owner", email: "owner@second.com", password: "password1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PLATFORM_ADMIN_TOKEN;
});

describe("POST /api/v1/admin/organizations", () => {
  it("is disabled (404) when PLATFORM_ADMIN_TOKEN is not configured", async () => {
    const res = await POST(req(validBody, "anything"));
    expect(res.status).toBe(404);
    expect(createOrganizationWithAdmin).not.toHaveBeenCalled();
  });

  it("401s when the token is missing", async () => {
    process.env.PLATFORM_ADMIN_TOKEN = "secret";
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
    expect(createOrganizationWithAdmin).not.toHaveBeenCalled();
  });

  it("401s when the token is wrong", async () => {
    process.env.PLATFORM_ADMIN_TOKEN = "secret";
    const res = await POST(req(validBody, "wrong"));
    expect(res.status).toBe(401);
    expect(createOrganizationWithAdmin).not.toHaveBeenCalled();
  });

  it("creates a new org with a correct token", async () => {
    process.env.PLATFORM_ADMIN_TOKEN = "secret";
    (createOrganizationWithAdmin as any).mockResolvedValue({ ok: true, organizationId: "o1", adminUserId: "u1" });
    const res = await POST(req(validBody, "secret"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ organizationId: "o1", adminUserId: "u1" });
  });

  it("400s on invalid input even with a valid token", async () => {
    process.env.PLATFORM_ADMIN_TOKEN = "secret";
    const res = await POST(req({ orgName: "", admin: { name: "", email: "nope", password: "x" } }, "secret"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/admin/organizations (support visibility)", () => {
  it("is 404 when disabled and 401 without the token", async () => {
    expect((await GET(getReq("x"))).status).toBe(404);
    process.env.PLATFORM_ADMIN_TOKEN = "secret";
    expect((await GET(getReq())).status).toBe(401);
  });

  it("lists orgs with plan/subscription + usage counts", async () => {
    process.env.PLATFORM_ADMIN_TOKEN = "secret";
    (prisma.organization.findMany as any).mockResolvedValue([
      {
        id: "o1", name: "Alpha", plan: "PRO", subscriptionStatus: "ACTIVE", emailVerified: true,
        createdAt: new Date("2026-01-01"), _count: { users: 4, items: 10, orders: 2 },
      },
    ]);
    const res = await GET(getReq("secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organizations[0]).toEqual(
      expect.objectContaining({ id: "o1", plan: "PRO", subscriptionStatus: "ACTIVE", usage: { users: 4, items: 10, orders: 2 } })
    );
  });
});
