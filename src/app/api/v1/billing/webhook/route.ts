import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/billing";

/**
 * Phase 13d — Stripe webhook receiver.
 *
 * Public (Stripe calls it), but every request is authenticated by verifying the
 * Stripe signature against STRIPE_WEBHOOK_SECRET over the RAW body — an
 * unverified/forged event is rejected with 400 before it can touch any org.
 */
export async function POST(req: Request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const raw = await req.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    // Bad signature / malformed payload — never trust it.
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // Return 500 so Stripe retries; log for diagnosis.
    console.error("stripe webhook handler error", err);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
