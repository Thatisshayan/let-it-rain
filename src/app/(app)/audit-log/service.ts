import { prisma } from "@/lib/prisma";

export type AuditLogEntry = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date;
  actor: { id: string; name: string };
  targetUser: { id: string; name: string } | null;
  order: { id: string; customerName: string } | null;
};

const AUDIT_LOG_INCLUDE = {
  actor: { select: { id: true, name: true } },
  targetUser: { select: { id: true, name: true } },
  order: { select: { id: true, customerName: true } },
} as const;

export async function listAuditLog(opts?: {
  page?: number;
  pageSize?: number;
  action?: string;
  actorId?: string;
  targetUserId?: string;
  orderId?: string;
}): Promise<AuditLogEntry[]> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
  const where = {
    ...(opts?.action ? { action: opts.action } : {}),
    ...(opts?.actorId ? { actorId: opts.actorId } : {}),
    ...(opts?.targetUserId ? { targetUserId: opts.targetUserId } : {}),
    ...(opts?.orderId ? { orderId: opts.orderId } : {}),
  };
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: AUDIT_LOG_INCLUDE,
  });
}

export async function listUserActivity(userId: string): Promise<AuditLogEntry[]> {
  return prisma.auditLog.findMany({
    where: {
      OR: [{ actorId: userId }, { targetUserId: userId }],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: AUDIT_LOG_INCLUDE,
  });
}