import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { PLANS, seatLimitFor } from "@/lib/plans";

/**
 * Phase 13d — the caller's own organization: plan, subscription state, and basic
 * usage. Org is session-derived, so a caller only ever sees their own org. Used
 * by the mobile app's Organization/plan screen and available to web too.
 */
export const GET = withAuth(async (_req, _ctx, session) => {
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, plan: true, subscriptionStatus: true, emailVerified: true },
  });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const activeUsers = await prisma.user.count({
    where: { organizationId: session.organizationId, active: true },
  });

  return NextResponse.json({
    organization: {
      name: org.name,
      plan: org.plan,
      planLabel: PLANS[org.plan].label,
      seatLimit: seatLimitFor(org.plan),
      subscriptionStatus: org.subscriptionStatus,
      emailVerified: org.emailVerified,
      usage: { activeUsers },
    },
  });
});
