import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { update: vi.fn(), findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { handleStripeEvent, mapStripeStatus } from "./billing";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_PRICE_PRO = "price_pro";
  process.env.STRIPE_PRICE_ENTERPRISE = "price_ent";
});

const ev = (type: string, object: any) => ({ type, data: { object } }) as any;

describe("mapStripeStatus", () => {
  it("maps Stripe statuses to our enum", () => {
    expect(mapStripeStatus("active")).toBe("ACTIVE");
    expect(mapStripeStatus("trialing")).toBe("TRIALING");
    expect(mapStripeStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeStatus("unpaid")).toBe("PAST_DUE");
    expect(mapStripeStatus("canceled")).toBe("CANCELED");
    expect(mapStripeStatus("something_else")).toBe("NONE");
  });
});

describe("handleStripeEvent", () => {
  it("checkout.session.completed links the subscription and activates the org's plan", async () => {
    (prisma.organization.update as any).mockResolvedValue({});
    await handleStripeEvent(
      ev("checkout.session.completed", {
        metadata: { organizationId: "org-1", plan: "PRO" },
        customer: "cus_1",
        subscription: "sub_1",
      })
    );
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        subscriptionStatus: "ACTIVE",
        plan: "PRO",
      }),
    });
  });

  it("ignores a checkout session with no organizationId metadata", async () => {
    const res = await handleStripeEvent(ev("checkout.session.completed", { metadata: {}, customer: "cus_x" }));
    expect(res.handled).toBe(false);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("customer.subscription.updated syncs status + plan by customer id", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: "org-1" });
    (prisma.organization.update as any).mockResolvedValue({});
    await handleStripeEvent(
      ev("customer.subscription.updated", {
        id: "sub_1",
        customer: "cus_1",
        status: "past_due",
        items: { data: [{ price: { id: "price_pro" } }] },
        current_period_end: 1_800_000_000,
      })
    );
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: "cus_1" } })
    );
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({ subscriptionStatus: "PAST_DUE", plan: "PRO" }),
    });
  });

  it("customer.subscription.deleted downgrades to FREE + CANCELED", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: "org-1" });
    (prisma.organization.update as any).mockResolvedValue({});
    await handleStripeEvent(ev("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled" }));
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({ subscriptionStatus: "CANCELED", plan: "FREE", stripeSubscriptionId: null }),
    });
  });

  it("invoice.payment_failed marks the org PAST_DUE (dunning)", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: "org-1" });
    (prisma.organization.update as any).mockResolvedValue({});
    await handleStripeEvent(ev("invoice.payment_failed", { customer: "cus_1" }));
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { subscriptionStatus: "PAST_DUE" },
    });
  });

  it("invoice.payment_succeeded marks the org ACTIVE", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: "org-1" });
    (prisma.organization.update as any).mockResolvedValue({});
    await handleStripeEvent(ev("invoice.payment_succeeded", { customer: "cus_1" }));
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { subscriptionStatus: "ACTIVE" },
    });
  });

  it("does not touch an org for an unknown customer", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    const res = await handleStripeEvent(ev("invoice.payment_failed", { customer: "cus_unknown" }));
    expect(res.handled).toBe(false);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("ignores unhandled event types", async () => {
    const res = await handleStripeEvent(ev("customer.created", { id: "cus_1" }));
    expect(res.handled).toBe(false);
  });
});
