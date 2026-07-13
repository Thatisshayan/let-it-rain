import Stripe from "stripe";
import type { Plan } from "@/generated/prisma/client";
import { PLANS } from "@/lib/plans";

/**
 * Phase 13d — Stripe client + price/plan mapping.
 *
 * The client is created lazily so the app (and every test that never touches
 * billing) runs fine without STRIPE_SECRET_KEY. Anything that actually needs
 * Stripe calls getStripe(), which throws a clear error when unconfigured; the
 * routes translate that into a 503 so billing is simply "not enabled" until an
 * operator sets the keys.
 */
let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  if (!client) client = new Stripe(key);
  return client;
}

/** The Stripe price id configured for a plan, or null if it has none / unset. */
export function priceIdForPlan(plan: Plan): string | null {
  const envVar = PLANS[plan].stripePriceEnvVar;
  if (!envVar) return null;
  return process.env[envVar] ?? null;
}

/** Reverse map: given a Stripe price id, which plan does it correspond to? */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const plan of ["FREE", "PRO", "ENTERPRISE"] as const) {
    const envVar = PLANS[plan].stripePriceEnvVar;
    if (envVar && process.env[envVar] === priceId) return plan;
  }
  return null;
}
