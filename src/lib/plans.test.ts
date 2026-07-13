import { describe, it, expect } from "vitest";
import { PLANS, seatLimitFor, planAllows, seatLimitReached } from "./plans";

describe("plans", () => {
  it("defines a seat limit for every plan (null = unlimited)", () => {
    expect(seatLimitFor("FREE")).toBe(3);
    expect(seatLimitFor("PRO")).toBe(25);
    expect(seatLimitFor("ENTERPRISE")).toBeNull();
  });

  it("seatLimitReached is true only at/over a finite limit", () => {
    expect(seatLimitReached("FREE", 2)).toBe(false);
    expect(seatLimitReached("FREE", 3)).toBe(true);
    expect(seatLimitReached("FREE", 4)).toBe(true);
    // Unlimited never blocks.
    expect(seatLimitReached("ENTERPRISE", 10_000)).toBe(false);
  });

  it("gates features by plan", () => {
    expect(planAllows("FREE", "advancedReports")).toBe(false);
    expect(planAllows("PRO", "advancedReports")).toBe(true);
    expect(planAllows("ENTERPRISE", "advancedReports")).toBe(true);
  });

  it("every plan has a human label", () => {
    for (const p of ["FREE", "PRO", "ENTERPRISE"] as const) {
      expect(PLANS[p].label.length).toBeGreaterThan(0);
    }
  });
});
