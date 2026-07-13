import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/org-provisioning", () => ({
  createOrganizationWithAdmin: vi.fn(),
}));

import { createOrganizationWithAdmin } from "@/lib/org-provisioning";
import { POST } from "./route";

function req(body: unknown, token?: string) {
  return new Request("http://localhost/api/v1/admin/organizations", {
    method: "POST",
    headers: token ? { "x-platform-admin-token": token } : {},
    body: JSON.stringify(body),
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
