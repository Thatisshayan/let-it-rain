import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  groupMovementsByDay,
  monthLabel,
  adjacentMonth,
  monthRange,
  parseMonthParam,
} from "./calendar";

describe("buildMonthGrid", () => {
  it("returns full weeks covering the whole month for July 2026", () => {
    const weeks = buildMonthGrid(2026, 7);
    const allCells = weeks.flat();

    expect(allCells.length % 7).toBe(0);

    const inMonthDates = allCells.filter((c) => c.inMonth).map((c) => c.date);
    expect(inMonthDates).toHaveLength(31);
    expect(inMonthDates[0]).toBe("2026-07-01");
    expect(inMonthDates[inMonthDates.length - 1]).toBe("2026-07-31");
  });

  it("handles February in a non-leap year (28 days)", () => {
    const weeks = buildMonthGrid(2026, 2);
    const inMonthDates = weeks.flat().filter((c) => c.inMonth);
    expect(inMonthDates).toHaveLength(28);
  });

  it("handles February in a leap year (29 days)", () => {
    const weeks = buildMonthGrid(2028, 2);
    const inMonthDates = weeks.flat().filter((c) => c.inMonth);
    expect(inMonthDates).toHaveLength(29);
  });
});

describe("groupMovementsByDay", () => {
  it("sums delta and counts movements per day", () => {
    const result = groupMovementsByDay([
      { createdAt: "2026-07-09T10:00:00.000Z", delta: 5 },
      { createdAt: "2026-07-09T14:00:00.000Z", delta: -2 },
      { createdAt: "2026-07-10T09:00:00.000Z", delta: 3 },
    ]);

    expect(result.get("2026-07-09")).toEqual({ net: 3, count: 2 });
    expect(result.get("2026-07-10")).toEqual({ net: 3, count: 1 });
    expect(result.has("2026-07-11")).toBe(false);
  });

  it("returns an empty map for no movements", () => {
    expect(groupMovementsByDay([]).size).toBe(0);
  });
});

describe("monthLabel", () => {
  it("formats a month and year", () => {
    expect(monthLabel(2026, 7)).toBe("July 2026");
  });
});

describe("adjacentMonth", () => {
  it("moves forward across a year boundary", () => {
    expect(adjacentMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("moves backward across a year boundary", () => {
    expect(adjacentMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("monthRange", () => {
  it("returns first-of-month through first-of-next-month", () => {
    const { start, end } = monthRange(2026, 7);
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM string", () => {
    expect(parseMonthParam("2026-03")).toEqual({ year: 2026, month: 3 });
  });

  it("falls back to the current month for an invalid string", () => {
    const now = new Date();
    expect(parseMonthParam("not-a-month")).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });

  it("falls back to the current month when undefined", () => {
    const now = new Date();
    expect(parseMonthParam(undefined)).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });
});
