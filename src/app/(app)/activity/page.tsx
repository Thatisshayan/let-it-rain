import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canManageOrders } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/activity?month=${monthParam(prev.year, prev.month)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← Prev
          </Link>
          <span className="w-40 text-center text-sm font-medium">{monthLabel(year, month)}</span>
          <Link
            href={`/activity?month=${monthParam(next.year, next.month)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Next →
          </Link>
        </div>
      </div>

      <Card>
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
                      "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm text-foreground transition-colors",
                      cell.inMonth ? "border-border" : "border-transparent text-muted-foreground/40",
                      bgClass,
                      isSelected && "ring-2 ring-primary"
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

      {day && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dayMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock movements on this day.</p>
            ) : (
              <ul className="divide-y">
                {dayMovements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <Link href={`/items/${m.item.id}`} className="font-medium hover:underline">
                        {m.item.name}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        — {MOVEMENT_LABEL[m.type] ?? m.type} ({m.delta > 0 ? "+" : ""}
                        {m.delta}) by {m.user.name}
                      </span>
                      {m.reason && <p className="mt-1 text-xs text-muted-foreground">{m.reason}</p>}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {new Date(m.createdAt).toLocaleTimeString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
