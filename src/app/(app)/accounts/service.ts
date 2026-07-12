import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Bumps the user's tokenVersion so all existing sessions for that user
 * are immediately invalidated. Use cases:
 *   - Admin "Sign out everywhere" for a still-active user
 *   - Self-service from the Account tab ("Sign me out everywhere")
 *
 * The next request from any of that user's sessions will fail
 * verifyBearerToken() with a 401 (tokenVersion mismatch), triggering
 * a re-login.
 */
export async function revokeUserSessions(
  actor: SessionPayload,
  targetUserId: string
): Promise<Result> {
  if (actor.userId !== targetUserId) {
    if (!hasPermission(actor, "MANAGE_USERS")) {
      return { ok: false, error: "You don't have permission to manage users." };
    }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { tokenVersion: { increment: 1 } },
  });

  await writeAuditLog({
    actor,
    action: "USER_TOKEN_VERSION_BUMPED",
    targetUserId,
    detail: "All sessions revoked (token version incremented)",
  });

  return { ok: true };
}