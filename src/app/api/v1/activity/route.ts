import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { canManageOrders } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import {
  parseMonthParam,
  monthLabel,
  monthRange,
  buildMonthGrid,
  groupMovementsByDay,
} from "@/app/(app)/activity/calendar";

async function getMovements(session: SessionPayload, start: Date, end: Date) {
  const canManage = canManageOrders(session);
  const where: Prisma.MovementWhereInput = {
    organizationId: session.organizationId,
    createdAt: { gte: start, lt: end },
  };
  if (!canManage) {
    where.userId = session.userId;
  }

  return prisma.movement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { item: { select: { id: true, name: true } }, user: { select: { name: true } } },
  });
}

export const GET = withAuth(async (req, _ctx, session) => {
  const url = new URL(req.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);

  const movements = await getMovements(session, start, end);

  const byDay = groupMovementsByDay(movements);
  const weeks = buildMonthGrid(year, month);

  return NextResponse.json({
    year,
    month,
    monthLabel: monthLabel(year, month),
    weeks,
    days: Object.fromEntries(byDay),
    movements: movements.map((m) => ({
      id: m.id,
      itemId: m.item.id,
      itemName: m.item.name,
      type: m.type,
      delta: m.delta,
      reason: m.reason,
      userName: m.user.name,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});
