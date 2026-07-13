import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrganizationWithAdmin } from "@/lib/org-provisioning";
import { prisma } from "@/lib/prisma";

/** Shared platform-admin gate: 404 when disabled, 401 on missing/wrong token. */
function platformAdminError(req: Request): NextResponse | null {
  const expected = process.env.PLATFORM_ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const provided = req.headers.get("x-platform-admin-token");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

/**
 * Phase 13c — admin-only organization creation endpoint.
 *
 * Gated by a platform bootstrap secret (PLATFORM_ADMIN_TOKEN), NOT by the normal
 * user-permission model — creating a tenant is a platform-operator action, above
 * any single org's admin. Deliberately:
 *  - Disabled (404) when PLATFORM_ADMIN_TOKEN is unset, so it's inert by default.
 *  - Requires the exact token in the `x-platform-admin-token` header.
 *  - Only ever CREATES a new org (see createOrganizationWithAdmin) — there is no
 *    input for an existing org id, so it can't attach an admin to an existing
 *    tenant.
 * This is not public self-serve signup (that is 13d).
 */
const bodySchema = z.object({
  orgName: z.string().trim().min(1).max(200),
  admin: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(8).max(200),
  }),
  settings: z
    .object({
      businessName: z.string().trim().max(200).optional(),
      defaultLowStock: z.number().int().min(0).optional(),
    })
    .optional(),
});

/**
 * Phase 13d — minimal customer-support visibility: list every org with its
 * plan/subscription state and basic usage counts. Same platform-admin gate as
 * POST (not a normal user permission).
 */
export async function GET(req: Request) {
  const gate = platformAdminError(req);
  if (gate) return gate;

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { users: true, items: true, orders: true } },
    },
  });

  return NextResponse.json({
    organizations: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      plan: o.plan,
      subscriptionStatus: o.subscriptionStatus,
      emailVerified: o.emailVerified,
      createdAt: o.createdAt.toISOString(),
      usage: { users: o._count.users, items: o._count.items, orders: o._count.orders },
    })),
  });
}

export async function POST(req: Request) {
  const gate = platformAdminError(req);
  if (gate) return gate;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const res = await createOrganizationWithAdmin(parsed.data);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ organizationId: res.organizationId, adminUserId: res.adminUserId }, { status: 201 });
}
