import { describe, expect, it } from "vitest";
import { computeMovement } from "./movement";

describe("computeMovement", () => {
  it("RECEIVE increases quantity by the amount", () => {
    const result = computeMovement(10, { type: "RECEIVE", amount: 5, reason: undefined });
    expect(result).toEqual({ ok: true, delta: 5, quantityAfter: 15 });
  });

  it("REMOVE decreases quantity by the amount", () => {
    const result = computeMovement(10, { type: "REMOVE", amount: 4, isSale: false, reason: undefined });
    expect(result).toEqual({ ok: true, delta: -4, quantityAfter: 6 });
  });

  it("REMOVE rejects removing more than current stock", () => {
    const result = computeMovement(3, { type: "REMOVE", amount: 4, isSale: false, reason: undefined });
    expect(result).toEqual({ ok: false, error: "Cannot remove more than current stock." });
  });

  it("REMOVE allows removing exactly the full stock", () => {
    const result = computeMovement(4, { type: "REMOVE", amount: 4, isSale: false, reason: undefined });
    expect(result).toEqual({ ok: true, delta: -4, quantityAfter: 0 });
  });

  it("ADJUST with no variance requires no reason", () => {
    const result = computeMovement(10, { type: "ADJUST", counted: 10, reason: undefined });
    expect(result).toEqual({ ok: true, delta: 0, quantityAfter: 10 });
  });

  it("ADJUST with a variance requires a reason", () => {
    const result = computeMovement(10, { type: "ADJUST", counted: 7, reason: undefined });
    expect(result).toEqual({
      ok: false,
      error: "Please note a reason for the count variance.",
    });
  });

  it("ADJUST with a variance and a reason succeeds", () => {
    const result = computeMovement(10, { type: "ADJUST", counted: 7, reason: "Damaged stock" });
    expect(result).toEqual({ ok: true, delta: -3, quantityAfter: 7 });
  });

  it("ADJUST can increase the count above current stock", () => {
    const result = computeMovement(10, { type: "ADJUST", counted: 20, reason: "Found extra boxes" });
    expect(result).toEqual({ ok: true, delta: 10, quantityAfter: 20 });
  });

  it("ADJUST to zero is allowed", () => {
    const result = computeMovement(5, { type: "ADJUST", counted: 0, reason: "Sold out" });
    expect(result).toEqual({ ok: true, delta: -5, quantityAfter: 0 });
  });
});
