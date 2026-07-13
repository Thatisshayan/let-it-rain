import type { Plan } from "@/generated/prisma/client";

/**
 * Phase 13d — pricing tiers.
 *
 * Seat limits are the primary, non-invasive enforcement mechanism (a `null`
 * limit means unlimited). `features` is a small capability map for future
 * feature-gating; nothing existing is gated behind it yet, so retrofitting
 * tiers onto the current app can't break single-tenant behavior — the
 * grandfathered original tenant is ENTERPRISE regardless.
 *
 * These are sensible defaults chosen at the 13d trigger (customer:
 * LETTHESANDSHINE). Adjust the numbers / Stripe price ids to the real contract.
 */
export type PlanFeature = "advancedReports";

export type PlanDefinition = {
  label: string;
  /** Max active users; null = unlimited. */
  seatLimit: number | null;
  features: Record<PlanFeature, boolean>;
  /** Stripe price id (from env) used to open a checkout session for this plan. */
  stripePriceEnvVar?: string;
};

export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    label: "Free",
    seatLimit: 3,
    features: { advancedReports: false },
  },
  PRO: {
    label: "Pro",
    seatLimit: 25,
    features: { advancedReports: true },
    stripePriceEnvVar: "STRIPE_PRICE_PRO",
  },
  ENTERPRISE: {
    label: "Enterprise",
    seatLimit: null,
    features: { advancedReports: true },
    stripePriceEnvVar: "STRIPE_PRICE_ENTERPRISE",
  },
};

export function seatLimitFor(plan: Plan): number | null {
  return PLANS[plan].seatLimit;
}

export function planAllows(plan: Plan, feature: PlanFeature): boolean {
  return PLANS[plan].features[feature];
}

/** True when adding one more active user would exceed the plan's seat limit. */
export function seatLimitReached(plan: Plan, currentActiveSeats: number): boolean {
  const limit = seatLimitFor(plan);
  return limit !== null && currentActiveSeats >= limit;
}
