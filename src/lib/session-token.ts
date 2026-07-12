/**
 * Shared, edge-safe primitives for the session JWT: the cookie name and the
 * HS256 signing key. Deliberately has zero dependency on `next/headers` or
 * `@/lib/prisma` (which pulls in the Node-only `pg` driver) so it can be
 * imported from both `src/lib/auth.ts` (Node runtime) and `src/proxy.ts`
 * (Edge runtime middleware) without breaking the Edge bundle.
 */

export const SESSION_COOKIE = "litr_session";
export const SESSION_JWT_ALG = "HS256";

export function getSessionSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  return new TextEncoder().encode(secret);
}
