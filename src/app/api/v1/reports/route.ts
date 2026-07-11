import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/auth";
import { parseMonthParam, monthLabel, monthRange } from "@/app/(app)/activity/calendar";
import {
  totalRevenue,
  totalCogs,
  totalRestockCost,
  revenueByDay,
  salesByItem,
} from "@/app/(app)/reports/reports";

export async function GET(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined);
  const { start, end } = monthRange(year, month);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const [monthMovements, todaySaleMovements, items] = await Promise.all([
    prisma.movement.findMany({
      where: { createdAt: { gte: start, lt: end }, OR: [{ isSale: true }, { type: "RECEIVE" }] },
      include: { item: { select: { id: true, name: true } } },
    }),
    prisma.movement.findMany({
      where: { isSale: true, createdAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.item.findMany({
      where: { deletedAt: null },
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
      createdAt: m.createdAt,
    }))
  );

  const monthRevenue = totalRevenue(monthSales);
  const monthCogs = totalCogs(monthSales);
  const monthProfit = monthRevenue - monthCogs;
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
    monthRestockCost,
    inventoryValuation,
    revenueByDay: revenueByDayList,
    salesByItem: byItem,
  });
}
