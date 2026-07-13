import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailVerificationToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    organization: { update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
}));
vi.mock("@/lib/org-provisioning", () => ({ createOrganizationWithAdmin: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendVerificationEmail: vi.fn().mockResolvedValue({ sent: false }) }));

import { prisma } from "@/lib/prisma";
import { createOrganizationWithAdmin } from "@/lib/org-provisioning";
import { sendVerificationEmail } from "@/lib/email";
import { signUpOrganization, verifyEmailToken } from "./signup";

beforeEach(() => vi.clearAllMocks());

describe("signUpOrganization", () => {
  it("provisions an UNVERIFIED org, issues a hashed token, and sends email", async () => {
    (createOrganizationWithAdmin as any).mockResolvedValue({ ok: true, organizationId: "org-1", adminUserId: "u-1" });
    (prisma.emailVerificationToken.create as any).mockResolvedValue({});

    const res = await signUpOrganization({
      orgName: "New Biz",
      admin: { name: "Owner", email: "owner@new.com", password: "password1" },
      verifyBaseUrl: "https://app.example.com",
    });

    expect(res.ok).toBe(true);
    // The org is created unverified.
    expect(createOrganizationWithAdmin).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: false }));
    // A token row is written; only the HASH is stored (64 hex chars for sha256).
    const createArg = (prisma.emailVerificationToken.create as any).mock.calls[0][0];
    expect(createArg.data.organizationId).toBe("org-1");
    expect(createArg.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    if (res.ok) expect(createArg.data.tokenHash).not.toBe(res.verificationToken); // raw != stored
    expect(sendVerificationEmail).toHaveBeenCalled();
  });

  it("surfaces a provisioning failure (e.g. duplicate email)", async () => {
    (createOrganizationWithAdmin as any).mockResolvedValue({ ok: false, error: "A user with that email already exists." });
    const res = await signUpOrganization({
      orgName: "New Biz",
      admin: { name: "Owner", email: "dupe@x.com", password: "password1" },
      verifyBaseUrl: "https://app.example.com",
    });
    expect(res.ok).toBe(false);
    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
  });
});

describe("verifyEmailToken", () => {
  it("rejects an unknown token", async () => {
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue(null);
    const res = await verifyEmailToken("nope");
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an already-consumed token", async () => {
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue({
      id: "t1", organizationId: "org-1", consumedAt: new Date(), expiresAt: new Date(Date.now() + 1000),
    });
    const res = await verifyEmailToken("x");
    expect(res.ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue({
      id: "t1", organizationId: "org-1", consumedAt: null, expiresAt: new Date(Date.now() - 1000),
    });
    const res = await verifyEmailToken("x");
    expect(res.ok).toBe(false);
  });

  it("consumes a valid token and marks the org verified", async () => {
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue({
      id: "t1", organizationId: "org-1", consumedAt: null, expiresAt: new Date(Date.now() + 10_000),
    });
    const res = await verifyEmailToken("x");
    expect(res.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" }, data: expect.objectContaining({ consumedAt: expect.any(Date) }) })
    );
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: "org-1" }, data: { emailVerified: true } });
  });
});
