import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

export type AuditAction =
  | "USER_CREATED"
  | "USER_PERMISSIONS_CHANGED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_PASSWORD_RESET"
  | "USER_TOKEN_VERSION_BUMPED"
  | "ORDER_CREATED"
  | "ORDER_DRIVER_ASSIGNED"
  | "ORDER_ASSIGNED"
  | "ORDER_CANCELLED"
  | "ORDER_DELIVERED"
  | "SETTINGS_CHANGED";

export interface WriteAuditLogInput {
  actor: SessionPayload;
  action: AuditAction;
  targetUserId?: string;
  orderId?: string;
  detail: string;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actor.userId,
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      orderId: input.orderId ?? null,
      detail: input.detail,
    },
  });
}