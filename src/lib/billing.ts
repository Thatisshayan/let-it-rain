import type Stripe from "stripe";
import type { Plan, SubscriptionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getStripe, priceIdForPlan, planForPriceId } from "@/lib/stripe";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Map a Stripe subscription status to our enum. */
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "NONE";
  }
}

function periodEnd(sub: unknown): Date | null {
  // current_period_end's location has shifted across Stripe API versions; read
  // it defensively rather than binding to a specific typed shape.
  const raw = (sub as { current_period_end?: number | null } | null)?.current_period_end;
  return raw ? new Date(raw * 1000) : null;
}

/**
 * Apply a verified Stripe webhook event to our data model. Pure w.r.t. Stripe —
 * it only reads the (already signature-verified) event and writes to Prisma, so
 * it's fully unit-testable with fabricated events.
 *
 * All updates are keyed on the org's stripeCustomerId (or the org id we stamped
 * into checkout metadata), so an event can only ever affect the org it belongs
 * to — Stripe never tells us about another tenant's org id.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<{ handled: boolean }> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const organizationId = s.metadata?.organizationId;
      if (!organizationId) return { handled: false };
      const planFromMeta = (s.metadata?.plan as Plan | undefined) ?? null;
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          stripeCustomerId: typeof s.customer === "string" ? s.customer : (s.customer?.id ?? undefined),
          stripeSubscriptionId: typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? undefined),
          subscriptionStatus: "ACTIVE",
          ...(planFromMeta ? { plan: planFromMeta } : {}),
        },
      });
      return { handled: true };
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const priceId = sub.items?.data?.[0]?.price?.id;
      const plan = planForPriceId(priceId);
      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
      if (!org) return { handled: false };
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeSubscriptionId: sub.id,
          subscriptionStatus: mapStripeStatus(sub.status),
          currentPeriodEnd: periodEnd(sub),
          ...(plan ? { plan } : {}),
        },
      });
      return { handled: true };
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
      if (!org) return { handled: false };
      // Subscription gone — downgrade to FREE and mark canceled.
      await prisma.organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: "CANCELED", plan: "FREE", stripeSubscriptionId: null, currentPeriodEnd: null },
      });
      return { handled: true };
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (!customerId) return { handled: false };
      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
      if (!org) return { handled: false };
      await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: "ACTIVE" } });
      return { handled: true };
    }

    case "invoice.payment_failed": {
      // Dunning: mark past_due; Stripe keeps retrying per the account's settings.
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (!customerId) return { handled: false };
      const org = await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
      if (!org) return { handled: false };
      await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: "PAST_DUE" } });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

/**
 * Create a Stripe Checkout session so an org's admin can subscribe to a paid
 * plan. Org-scoped: the customer + metadata are derived from the caller's
 * session, never from client input.
 */
export async function createCheckoutSession(
  session: SessionPayload,
  plan: Plan,
  urls: { successUrl: string; cancelUrl: string }
): Promise<Result<{ url: string }>> {
  if (!hasPermission(session, "MANAGE_SETTINGS")) {
    return { ok: false, error: "You don't have permission to manage billing." };
  }
  if (plan === "FREE") return { ok: false, error: "The Free plan doesn't require checkout." };

  const priceId = priceIdForPlan(plan);
  if (!priceId) return { ok: false, error: "That plan isn't available for purchase." };

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };

  const stripe = getStripe();

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      name: org.name,
      metadata: { organizationId: org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customerId } });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    // Stamped so the webhook can attribute the result to THIS org only.
    metadata: { organizationId: org.id, plan },
  });

  if (!checkout.url) return { ok: false, error: "Could not start checkout." };
  return { ok: true, url: checkout.url };
}
