import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseMonthParam, monthLabel, adjacentMonth, monthRange } from "../activity/calendar";
import {
  totalRevenue,
  totalCogs,
  totalCash,
  totalInterac,
  totalRestockCost,
  revenueByDay,
  salesByItem,
} from "./reports";

function monthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "VIEW_REPORTS")) {
    return <div className="space-y-6"><p className="text-destructive">You don&apos;t have permission to view reports.</p></div>;
  }

  const { month: monthParamValue } = await searchParams;
  const { year, month } = parseMonthParam(monthParamValue);
  const { start, end } = monthRange(year, month);
  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);

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

  const daysWithSales = [...byDay.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/reports?month=${monthParam(prev.year, prev.month)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← Prev
          </Link>
          <span className="w-40 text-center text-sm font-medium">{monthLabel(year, month)}</span>
          <Link
            href={`/reports?month=${monthParam(next.year, next.month)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today&apos;s revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{money(todayRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cash this month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{money(monthCash)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Interac this month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{money(monthInterac)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {monthLabel(year, month)} revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{money(monthRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cost of goods sold</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{money(monthCogs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gross profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                monthProfit < 0 && "text-destructive"
              )}
            >
              {money(monthProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Restock cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{money(monthRestockCost)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Inventory valuation <span className="text-muted-foreground">(current, all items)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{money(inventoryValuation)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by day</CardTitle>
        </CardHeader>
        <CardContent>
          {daysWithSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded this month.</p>
          ) : (
            <ul className="space-y-2">
              {(() => {
                const maxRevenue = Math.max(...daysWithSales.map(([, revenue]) => revenue), 0.01);
                return daysWithSales.map(([day, revenue]) => (
                  <li key={day} className="flex items-center gap-3 py-1 text-sm">
                    <span className="w-24 shrink-0 text-muted-foreground">
                      {new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-rain"
                        style={{ width: `${Math.max(4, (revenue / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right tabular-nums font-medium">{money(revenue)}</span>
                  </li>
                ));
              })()}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales by item</CardTitle>
        </CardHeader>
        <CardContent>
          {byItem.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded this month.</p>
          ) : (
            <ul className="divide-y">
              {byItem.map((row) => (
                <li key={row.itemId} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <div>
                    <Link href={`/items/${row.itemId}`} className="font-medium hover:underline">
                      {row.itemName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.unitsSold} units sold</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-medium">{money(row.revenue)}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      profit {money(row.profit)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
