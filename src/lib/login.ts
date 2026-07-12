import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";

export const LOGIN_ATTEMPT_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Coarser, IP-only bucket so an attacker can't dodge the per-email limit by
// spraying attempts across many different email addresses from one IP.
export const LOGIN_IP_ATTEMPT_LIMIT = 30;
export const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;

export type LoginResult =
  | {
      ok: true;
      user: { id: string; email: string; name: string; permissions: string[]; tokenVersion: number };
    }
  | { ok: false; error: string; status: 401 | 429 };

/**
 * Best-effort client IP for rate-limit keying.
 *
 * On Vercel, `x-forwarded-for` is set by the platform's edge proxy and any
 * client-supplied value is overwritten, so trusting the first hop is safe.
 * On a bare Node/self-hosted deployment behind a different reverse proxy,
 * this header is attacker-controlled unless that proxy is configured to
 * strip/overwrite it — verify that before relying on this for anything
 * beyond best-effort abuse mitigation (it's a rate limit, not an authZ check).
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0]?.trim() || "unknown";

  const forwardedFor = headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function attemptLogin(
  email: string,
  password: string,
  ip: string
): Promise<LoginResult> {
  const ipOnlyAllowed = await checkRateLimit(`ip:${ip}`, LOGIN_IP_ATTEMPT_LIMIT, LOGIN_IP_WINDOW_MS);
  const rateLimitKey = `${ip}:${email}`;
  const perEmailAllowed = await checkRateLimit(rateLimitKey, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
  if (!ipOnlyAllowed || !perEmailAllowed) {
    return { ok: false, error: "Too many login attempts. Please try again later.", status: 429 };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { ok: false, error: "Invalid email or password.", status: 401 };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Invalid email or password.", status: 401 };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, permissions: user.permissions, tokenVersion: user.tokenVersion },
  };
}
