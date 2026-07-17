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
  | "ORDER_OUT_FOR_DELIVERY"
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

type AuditLogData = {
  organizationId: string;
  actorId: string;
  action: AuditAction;
  targetUserId: string | null;
  orderId: string | null;
  detail: string;
};

type AuditLogWriter = {
  auditLog: {
    create(args: { data: AuditLogData }): Promise<unknown>;
  };
};

function buildAuditLogData(input: WriteAuditLogInput): AuditLogData {
  return {
    // Org derived from the actor's session — audit entries belong to the
    // tenant the acting user is in.
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    orderId: input.orderId ?? null,
    detail: input.detail,
  };
}

export async function writeAuditLogTx(
  tx: AuditLogWriter,
  input: WriteAuditLogInput
): Promise<void> {
  await tx.auditLog.create({ data: buildAuditLogData(input) });
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await writeAuditLogTx(prisma, input);
}
