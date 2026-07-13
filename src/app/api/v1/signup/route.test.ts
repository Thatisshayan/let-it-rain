import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/signup", () => ({ signUpOrganization: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { signUpOrganization } from "@/lib/signup";
import { checkRateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const body = { orgName: "New Biz", admin: { name: "Owner", email: "owner@new.com", password: "password1" } };
const req = () => new Request("http://localhost/api/v1/signup", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = "test";
});

describe("POST /api/v1/signup", () => {
  it("429s when the IP rate limit is exceeded (abuse protection)", async () => {
    (checkRateLimit as any).mockResolvedValue(false);
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(signUpOrganization).not.toHaveBeenCalled();
  });

  it("400s on invalid input", async () => {
    (checkRateLimit as any).mockResolvedValue(true);
    const res = await POST(new Request("http://localhost/api/v1/signup", { method: "POST", body: JSON.stringify({ orgName: "" }) }));
    expect(res.status).toBe(400);
  });

  it("creates the org and (non-prod) returns the verification token", async () => {
    (checkRateLimit as any).mockResolvedValue(true);
    (signUpOrganization as any).mockResolvedValue({ ok: true, organizationId: "o1", adminUserId: "u1", verificationToken: "raw-token", emailSent: false });
    const res = await POST(req());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.organizationId).toBe("o1");
    expect(json.verificationToken).toBe("raw-token"); // exposed only in non-prod
  });

  it("does not leak the verification token in production", async () => {
    process.env.NODE_ENV = "production";
    (checkRateLimit as any).mockResolvedValue(true);
    (signUpOrganization as any).mockResolvedValue({ ok: true, organizationId: "o1", adminUserId: "u1", verificationToken: "raw-token", emailSent: true });
    const res = await POST(req());
    const json = await res.json();
    expect(json.verificationToken).toBeUndefined();
  });

  it("400s when signup fails (e.g. duplicate email)", async () => {
    (checkRateLimit as any).mockResolvedValue(true);
    (signUpOrganization as any).mockResolvedValue({ ok: false, error: "A user with that email already exists." });
    const res = await POST(req());
    expect(res.status).toBe(400);
  });
});
