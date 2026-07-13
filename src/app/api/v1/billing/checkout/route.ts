import { NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api-auth";
import { stripeConfigured } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/billing";

const bodySchema = z.object({ plan: z.enum(["PRO", "ENTERPRISE"]) });

// Phase 13d: start a subscription checkout for the caller's org.
export const POST = withPermission("MANAGE_SETTINGS", async (req, _ctx, session) => {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const base = process.env.APP_URL ?? origin;
  const result = await createCheckoutSession(session, parsed.data.plan, {
    successUrl: `${base}/settings?tab=org&billing=success`,
    cancelUrl: `${base}/settings?tab=org&billing=cancelled`,
  });
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ url: result.url });
});
