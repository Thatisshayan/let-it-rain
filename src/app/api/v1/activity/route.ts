import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import {
  parseMonthParam,
  monthLabel,
  monthRange,
  buildMonthGrid,
  groupMovementsByDay,
} from "@/app/(app)/activity/calendar";

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);

  const movements = await prisma.movement.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
    include: { item: { select: { id: true, name: true } }, user: { select: { name: true } } },
  });

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
