import type { MovementFormInput } from "./schemas";

export type MovementResult =
  | { ok: true; delta: number; quantityAfter: number }
  | { ok: false; error: string };

/**
 * Pure calculation of the stock delta for a movement, given the item's
 * current quantity. Kept separate from the server action so it can be
 * unit tested without a database.
 */
export function computeMovement(
  currentQuantity: number,
  input: MovementFormInput
): MovementResult {
  if (input.type === "RECEIVE") {
    return {
      ok: true,
      delta: input.amount,
      quantityAfter: currentQuantity + input.amount,
    };
  }

  if (input.type === "REMOVE") {
    if (input.amount > currentQuantity) {
      return { ok: false, error: "Cannot remove more than current stock." };
    }
    return {
      ok: true,
      delta: -input.amount,
      quantityAfter: currentQuantity - input.amount,
    };
  }

  // ADJUST
  const delta = input.counted - currentQuantity;
  if (delta !== 0 && !input.reason) {
    return { ok: false, error: "Please note a reason for the count variance." };
  }
  return { ok: true, delta, quantityAfter: input.counted };
}
