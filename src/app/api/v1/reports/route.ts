import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { parseMonthParam, monthLabel, monthRange } from "@/app/(app)/activity/calendar";
import {
  totalRevenue,
  totalCogs,
  totalCash,
  totalInterac,
  totalRestockCost,
  revenueByDay,
  salesByItem,
} from "@/app/(app)/reports/reports";

export const GET = withAuth(async (req, _ctx, session) => {
  if (!hasPermission(session, "VIEW_REPORTS")) {
    return NextResponse.json({ error: "You don't have permission to view reports." }, { status: 403 });
  }

  const url = new URL(req.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const [monthMovements, todaySaleMovements, items] = await Promise.all([
    prisma.movement.findMany({
      where: { organizationId: session.organizationId, createdAt: { gte: start, lt: end }, OR: [{ isSale: true }, { type: "RECEIVE" }] },
      include: { item: { select: { id: true, name: true } } },
    }),
    prisma.movement.findMany({
      where: { organizationId: session.organizationId, isSale: true, createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.item.findMany({
      where: { organizationId: session.organizationId, deletedAt: null },
      select: { quantity: true, unitCost: true },
    }),
  ]);

  const monthSales = monthMovements
    .filter((m) => m.isSale)
    .map((m) => ({
      itemId: m.item.id,
      itemName: m.item.name,
      delta: m.delta,
      unitPriceAtTime: m.unitPriceAtTime ? Number(m.unitPriceAtTime) : null,
      unitCostAtTime: m.unitCostAtTime ? Number(m.unitCostAtTime) : null,
      cashAmount: m.cashAmount ? Number(m.cashAmount) : null,
      interacAmount: m.interacAmount ? Number(m.interacAmount) : null,
      createdAt: m.createdAt,
    }));

  const monthRestocks = monthMovements
    .filter((m) => m.type === "RECEIVE")
    .map((m) => ({
      delta: m.delta,
      unitCostAtTime: m.unitCostAtTime ? Number(m.unitCostAtTime) : null,
      createdAt: m.createdAt,
    }));

  const todayRevenue = totalRevenue(
    todaySaleMovements.map((m) => ({
      itemId: "",
      itemName: "",
      delta: m.delta,
      unitPriceAtTime: m.unitPriceAtTime ? Number(m.unitPriceAtTime) : null,
      unitCostAtTime: null,
      cashAmount: null,
      interacAmount: null,
      createdAt: m.createdAt,
    }))
  );

  const monthRevenue = totalRevenue(monthSales);
  const monthCogs = totalCogs(monthSales);
  const monthProfit = monthRevenue - monthCogs;
  const monthCash = totalCash(monthSales);
  const monthInterac = totalInterac(monthSales);
  const monthRestockCost = totalRestockCost(monthRestocks);
  const inventoryValuation = items.reduce((sum, i) => sum + i.quantity * Number(i.unitCost), 0);
  const byDay = revenueByDay(monthSales);
  const byItem = salesByItem(monthSales);

  const revenueByDayList = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, revenue]) => ({ date, revenue }));

  return NextResponse.json({
    year,
    month,
    monthLabel: monthLabel(year, month),
    todayRevenue,
    monthRevenue,
    monthCogs,
    monthProfit,
    monthCash,
    monthInterac,
    monthRestockCost,
    inventoryValuation,
    revenueByDay: revenueByDayList,
    salesByItem: byItem,
  });
});
