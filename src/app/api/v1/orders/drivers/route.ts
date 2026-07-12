import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/api-auth";

// Deliberately minimal (id/name only, active users only) — MANAGE_ORDERS holders
// need this to assign a driver, but shouldn't necessarily see the full user list
// (email, permissions) that GET /api/v1/users exposes to MANAGE_USERS holders.
export const GET = withPermission("MANAGE_ORDERS", async () => {
  const drivers = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ drivers });
});
