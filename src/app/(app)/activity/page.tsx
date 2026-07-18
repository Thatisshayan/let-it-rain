import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageOrders } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MetricCard,
  MetricGrid,
  PageHeader,
  SectionHeading,
} from "@/components/app/page-header";
import {
  parseMonthParam,
  monthLabel,
  adjacentMonth,
  monthRange,
  buildMonthGrid,
  groupMovementsByDay,
} from "./calendar";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIVE: "Received",
  REMOVE: "Removed",
  ADJUST: "Count adjusted",
};

function monthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

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

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { month: monthParamValue, day } = await searchParams;
  const { year, month } = parseMonthParam(monthParamValue);
  const { start, end } = monthRange(year, month);
  const prev = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);

  const movements = await getMovements(session, start, end);

  const byDay = groupMovementsByDay(movements);
  const weeks = buildMonthGrid(year, month);

  const dayMovements = day ? movements.filter((m) => m.createdAt.toISOString().slice(0, 10) === day) : [];
  const activeDays = byDay.size;
  const totalNet = movements.reduce((sum, movement) => sum + movement.delta, 0);
  const selectedDayLabel = day
    ? new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "No day selected";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Movement calendar"
        title={`See the operational rhythm of ${monthLabel(year, month)} without losing the day-level detail.`}
        description="Calendar density shows whether stock moved, in what direction, and when to drill down into the ledger."
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Link
              href={`/activity?month=${monthParam(prev.year, prev.month)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              ← Prev
            </Link>
            <span className="order-first w-full text-center text-sm font-medium sm:order-none sm:w-auto sm:min-w-40">{monthLabel(year, month)}</span>
            <Link
              href={`/activity?month=${monthParam(next.year, next.month)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Next →
            </Link>
          </div>
        }
      >
        <MetricGrid>
          <MetricCard label="Movements" value={movements.length} hint="Entries in selected month" />
          <MetricCard label="Active days" value={activeDays} hint="Calendar days with any movement" />
          <MetricCard
            label="Net delta"
            value={`${totalNet > 0 ? "+" : ""}${totalNet}`}
            hint="Aggregate stock change"
            tone={totalNet < 0 ? "warning" : totalNet > 0 ? "success" : "default"}
          />
          <MetricCard label="Selected day" value={day ? day : "—"} hint={selectedDayLabel} />
        </MetricGrid>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <Card className="editorial-surface rounded-[1.8rem]">
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="pb-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flatMap((week) =>
              week.map((cell) => {
                const summary = byDay.get(cell.date);
                const isSelected = day === cell.date;
                const dayNum = Number(cell.date.slice(-2));
                const bgClass = !summary
                  ? ""
                  : summary.net > 0
                    ? "bg-success/15"
                    : summary.net < 0
                      ? "bg-warning/15"
                      : "bg-rain/15";
                const deltaClass = !summary
                  ? ""
                  : summary.net > 0
                    ? "text-success"
                    : summary.net < 0
                      ? "text-warning"
                      : "text-rain";
                return (
                  <Link
                    key={cell.date}
                    href={`/activity?month=${monthParam(year, month)}&day=${cell.date}`}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-[1rem] border text-sm text-foreground transition-colors",
                      cell.inMonth ? "border-border/75" : "border-transparent text-muted-foreground/40",
                      bgClass,
                      isSelected && "ring-2 ring-primary",
                      "hover:bg-foreground/[0.03]"
                    )}
                  >
                    <span className="font-medium">{dayNum}</span>
                    {summary && (
                      <span className={cn("text-[10px] font-semibold tabular-nums", deltaClass)}>
                        {summary.net > 0 ? "+" : ""}
                        {summary.net}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

        <Card className="editorial-surface rounded-[1.8rem]">
          <CardHeader>
            <SectionHeading
              title={selectedDayLabel}
              description={day ? "Movement ledger for the selected day." : "Select a day in the calendar to inspect its movement ledger."}
            />
          </CardHeader>
          <CardContent>
            {!day ? (
              <p className="text-sm text-muted-foreground">Choose a day from the calendar to inspect entries.</p>
            ) : dayMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock movements on this day.</p>
            ) : (
              <ul className="divide-y divide-border/75">
                {dayMovements.map((m) => (
                  <li key={m.id} className="grid gap-3 py-4 text-sm md:grid-cols-[8rem_minmax(0,1fr)_5rem] md:items-start">
                    <div className="rule-label text-primary/80">{MOVEMENT_LABEL[m.type] ?? m.type}</div>
                    <div>
                      <Link href={`/items/${m.item.id}`} className="font-medium hover:underline">
                        {m.item.name}
                      </Link>
                      <p className="mt-1 text-muted-foreground">
                        Delta {m.delta > 0 ? "+" : ""}
                        {m.delta} by {m.user.name}
                      </p>
                      {m.reason && <p className="mt-1 text-xs text-muted-foreground">{m.reason}</p>}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground md:text-right">
                      {new Date(m.createdAt).toLocaleTimeString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
