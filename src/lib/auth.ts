import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_JWT_ALG, getSessionSecretKey } from "@/lib/session-token";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  permissions: string[];
  tokenVersion: number;
};

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: SESSION_JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSessionSecretKey());
}

/**
 * Re-fetches the user's current permissions/active status from the DB
 * instead of trusting the JWT's embedded (possibly stale, up to 30 days
 * old) permissions snapshot. Returns null if the user no longer exists or
 * has been deactivated since the token was issued, or if their
 * tokenVersion has been incremented (admin "sign out everywhere" or
 * major permission change).
 */
async function resolveCurrentSession(userId: string, tokenVersion: number): Promise<SessionPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, permissions: true, active: true, tokenVersion: true },
  });
  if (!user || !user.active) return null;
  if (user.tokenVersion !== tokenVersion) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    permissions: user.permissions,
    tokenVersion: user.tokenVersion,
  };
}

export async function verifyBearerToken(req: Request): Promise<SessionPayload | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey());
    const p = payload as unknown as SessionPayload;
    return resolveCurrentSession(p.userId, p.tokenVersion);
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await signSessionToken(payload);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey());
    const p = payload as unknown as SessionPayload;
    return resolveCurrentSession(p.userId, p.tokenVersion);
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
