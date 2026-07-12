import { describe, it, expect } from "vitest";
import { totalCash, totalInterac } from "./reports";

const sale = (cashAmount: number | null, interacAmount: number | null) => ({
  itemId: "i1",
  itemName: "Widget",
  delta: -1,
  unitPriceAtTime: null,
  unitCostAtTime: null,
  cashAmount,
  interacAmount,
  createdAt: new Date(),
});

describe("totalCash / totalInterac", () => {
  it("sums cash and interac amounts independently across sales", () => {
    const sales = [sale(10, 5), sale(0, 20), sale(null, null)];
    expect(totalCash(sales)).toBe(10);
    expect(totalInterac(sales)).toBe(25);
  });

  it("returns 0 for an empty list", () => {
    expect(totalCash([])).toBe(0);
    expect(totalInterac([])).toBe(0);
  });
});
