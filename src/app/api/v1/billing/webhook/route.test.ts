import { describe, it, expect, vi, beforeEach } from "vitest";

const constructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripeConfigured: () => !!process.env.STRIPE_SECRET_KEY,
  getStripe: () => ({ webhooks: { constructEvent } }),
}));
vi.mock("@/lib/billing", () => ({ handleStripeEvent: vi.fn().mockResolvedValue({ handled: true }) }));

import { handleStripeEvent } from "@/lib/billing";
import { POST } from "./route";

function req(body: string, sig?: string) {
  return new Request("http://localhost/api/v1/billing/webhook", {
    method: "POST",
    headers: sig ? { "stripe-signature": sig } : {},
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
});

describe("POST /api/v1/billing/webhook", () => {
  it("503 when billing is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await POST(req("{}", "sig"));
    expect(res.status).toBe(503);
  });

  it("400 when the signature header is missing", async () => {
    const res = await POST(req("{}"));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("400 when signature verification fails (forged event rejected)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(req("{}", "bad"));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("200 and dispatches the event when the signature is valid", async () => {
    const event = { type: "invoice.payment_failed", data: { object: {} } };
    constructEvent.mockReturnValue(event);
    const res = await POST(req(JSON.stringify(event), "good"));
    expect(res.status).toBe(200);
    expect(handleStripeEvent).toHaveBeenCalledWith(event);
  });
});
