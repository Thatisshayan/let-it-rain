import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api-auth";
import { listAuditLog } from "@/app/(app)/audit-log/service";

export const GET = withPermission("VIEW_AUDIT_LOG", async (req, _ctx, session) => {
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
  const action = url.searchParams.get("action") ?? undefined;
  const actorId = url.searchParams.get("actorId") ?? undefined;
  const targetUserId = url.searchParams.get("targetUserId") ?? undefined;
  const orderId = url.searchParams.get("orderId") ?? undefined;

  const entries = await listAuditLog(session.organizationId, { page, pageSize, action, actorId, targetUserId, orderId });
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
      actor: e.actor,
      targetUser: e.targetUser,
      order: e.order,
    })),
  });
});