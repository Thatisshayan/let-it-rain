import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createUserFormSchema } from "@/app/(app)/settings/schemas";
import { createUser } from "@/app/(app)/settings/service";

export async function GET(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json({ error: "You don't have permission to manage users." }, { status: 403 });
  }

  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      permissions: u.permissions,
      active: u.active,
    })),
  });
}

export async function POST(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
}
