import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withPermission } from "@/lib/api-auth";
import { createUserFormSchema } from "@/app/(app)/settings/schemas";
import { createUser } from "@/app/(app)/settings/service";

export const GET = withPermission("MANAGE_USERS", async (_req, _ctx, session) => {
  const users = await prisma.user.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      permissions: u.permissions,
      active: u.active,
    })),
  });
});

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = createUserFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await createUser(session, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ userId: result.userId }, { status: 201 });
});
