import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  MetricCard,
  MetricGrid,
  PageHeader,
  SectionHeading,
} from "@/components/app/page-header";

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
  const topItem = byItem[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounting snapshot"
        title={`Read the operating economics of ${monthLabel(year, month)} before you drill into detail.`}
        description={`Revenue, payment mix, profitability, restock spend, and valuation for ${monthLabel(year, month)}.`}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Link
              href={`/reports?month=${monthParam(prev.year, prev.month)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              ← Prev
            </Link>
            <span className="order-first w-full text-center text-sm font-medium sm:order-none sm:w-auto sm:min-w-40">{monthLabel(year, month)}</span>
            <Link
              href={`/reports?month=${monthParam(next.year, next.month)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Next →
            </Link>
          </div>
        }
      >
        <MetricGrid>
          <MetricCard label="Today's revenue" value={money(todayRevenue)} />
          <MetricCard label="Month revenue" value={money(monthRevenue)} />
          <MetricCard label="Gross profit" value={money(monthProfit)} tone={monthProfit < 0 ? "warning" : "success"} />
          <MetricCard
            label="Top seller"
            value={topItem ? topItem.itemName : "No sales"}
            hint={topItem ? `${topItem.unitsSold} units sold` : "No sales recorded this month"}
          />
        </MetricGrid>
      </PageHeader>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_20rem]">
        <Card className="editorial-surface rounded-[1.8rem]">
          <CardHeader>
            <SectionHeading
              title="Payment and margin ledger"
              description="Revenue composition, direct cost, and reinvestment pressure for the selected month."
            />
          </CardHeader>
          <CardContent className="grid gap-0 divide-y divide-border/75">
            {[
              { label: "Cash this month", value: money(monthCash), note: "Physical tender collected" },
              { label: "Interac this month", value: money(monthInterac), note: "Electronic payment total" },
              { label: "Cost of goods sold", value: money(monthCogs), note: "Recognized cost on sold units" },
              { label: "Restock cost", value: money(monthRestockCost), note: "Inbound inventory spend" },
            ].map((row) => (
              <div
                key={row.label}
                className="grid gap-2 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div>
                  <p className="rule-label">{row.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.note}</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground md:text-right">
                  {row.value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="editorial-surface rounded-[1.8rem]">
          <CardHeader>
            <SectionHeading
              title="Inventory valuation"
              description="Current on-hand stock value."
            />
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums">{money(inventoryValuation)}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Based on current quantity multiplied by current weighted unit cost across all non-deleted items.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="editorial-surface rounded-[1.8rem]">
        <CardHeader>
          <SectionHeading
            title="Revenue by day"
            description="Spot spikes, flat days, and month pacing without leaving the page."
          />
        </CardHeader>
        <CardContent>
          {daysWithSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded this month.</p>
          ) : (
            <ul className="space-y-3">
              {(() => {
                const maxRevenue = Math.max(...daysWithSales.map(([, revenue]) => revenue), 0.01);
                return daysWithSales.map(([day, revenue]) => (
                  <li
                    key={day}
                    className="grid items-center gap-3 text-sm md:grid-cols-[8rem_minmax(0,1fr)_7rem]"
                  >
                    <span className="text-muted-foreground">
                      {new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <div className="relative h-10 overflow-hidden rounded-full border border-border/75 bg-muted/55 px-3">
                      <div
                        className="absolute inset-y-1 left-1 rounded-full bg-gradient-to-r from-primary to-rain"
                        style={{ width: `${Math.max(4, (revenue / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums font-medium">{money(revenue)}</span>
                  </li>
                ));
              })()}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="editorial-surface rounded-[1.8rem]">
        <CardHeader>
          <SectionHeading
            title="Sales by item"
            description="Which products are driving revenue and where profit is actually coming from."
          />
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
