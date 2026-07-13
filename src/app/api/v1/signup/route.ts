import { NextResponse } from "next/server";
import { z } from "zod";
import { signUpOrganization } from "@/lib/signup";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/login";

/**
 * Phase 13d — public self-serve signup.
 *
 * Rate-limited by client IP (abuse protection for a public, unauthenticated
 * endpoint). Creates an UNVERIFIED org + admin and issues an email-verification
 * token. In non-production the raw token is returned to ease testing; in
 * production it is only delivered by email.
 */
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 5 orgs/hour/IP

const bodySchema = z.object({
  orgName: z.string().trim().min(1).max(200),
  admin: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(8).max(200),
  }),
});

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const allowed = await checkRateLimit(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many signups. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const result = await signUpOrganization({ ...parsed.data, verifyBaseUrl: base });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const payload: Record<string, unknown> = { organizationId: result.organizationId, emailSent: result.emailSent };
  if (process.env.NODE_ENV !== "production") {
    // Dev/test convenience only — never leak the token in production.
    payload.verificationToken = result.verificationToken;
  }
  return NextResponse.json(payload, { status: 201 });
}
