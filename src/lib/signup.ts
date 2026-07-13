import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createOrganizationWithAdmin } from "@/lib/org-provisioning";
import { sendVerificationEmail } from "@/lib/email";

/**
 * Phase 13d — public self-serve signup.
 *
 * Builds on 13c's admin provisioning but creates the org UNVERIFIED and issues a
 * single-use email-verification token (only its SHA-256 hash is stored). The
 * calling route is responsible for rate-limiting/abuse protection.
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type SignupResult =
  | { ok: true; organizationId: string; adminUserId: string; verificationToken: string; emailSent: boolean }
  | { ok: false; error: string };

export async function signUpOrganization(input: {
  orgName: string;
  admin: { name: string; email: string; password: string };
  verifyBaseUrl: string;
}): Promise<SignupResult> {
  const provisioned = await createOrganizationWithAdmin({
    orgName: input.orgName,
    admin: input.admin,
    emailVerified: false, // public signup starts unverified
  });
  if (!provisioned.ok) return { ok: false, error: provisioned.error };

  const rawToken = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      organizationId: provisioned.organizationId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const verifyUrl = `${input.verifyBaseUrl}/verify-email?token=${rawToken}`;
  const { sent } = await sendVerificationEmail({ to: input.admin.email, orgName: input.orgName, verifyUrl });

  return {
    ok: true,
    organizationId: provisioned.organizationId,
    adminUserId: provisioned.adminUserId,
    verificationToken: rawToken,
    emailSent: sent,
  };
}

export type VerifyResult = { ok: true; organizationId: string } | { ok: false; error: string };

export async function verifyEmailToken(rawToken: string): Promise<VerifyResult> {
  if (!rawToken) return { ok: false, error: "Missing token." };
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record) return { ok: false, error: "Invalid or expired verification link." };
  if (record.consumedAt) return { ok: false, error: "This verification link has already been used." };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, error: "This verification link has expired." };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    prisma.organization.update({ where: { id: record.organizationId }, data: { emailVerified: true } }),
  ]);

  return { ok: true, organizationId: record.organizationId };
}
