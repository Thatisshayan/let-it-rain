export type MonthCell = { date: string; inMonth: boolean };

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseMonthParam(month: string | undefined): { year: number; month: number } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function monthLabel(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function adjacentMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** [start, end) — first of the given month through first of the next month. */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * Builds a Sunday-start month grid as an array of 7-day weeks, padded with
 * the trailing days of the previous/next month so every week is complete.
 */
export function buildMonthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: MonthCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1, -i));
    cells.push({ date: toDateStr(d), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toDateStr(new Date(Date.UTC(year, month - 1, day))), inMonth: true });
  }
  let trailingDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: toDateStr(new Date(Date.UTC(year, month, trailingDay))), inMonth: false });
    trailingDay += 1;
  }

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export type MovementForGrouping = { createdAt: string | Date; delta: number };
export type DaySummary = { net: number; count: number };

export function groupMovementsByDay(movements: MovementForGrouping[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const m of movements) {
    const d = typeof m.createdAt === "string" ? new Date(m.createdAt) : m.createdAt;
    const key = toDateStr(d);
    const entry = map.get(key) ?? { net: 0, count: 0 };
    entry.net += m.delta;
    entry.count += 1;
    map.set(key, entry);
  }
  return map;
}
