import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { updatePermissionsFormSchema } from "@/app/(app)/settings/schemas";
import { updateUserPermissions } from "@/app/(app)/settings/service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updatePermissionsFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await updateUserPermissions(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission to manage") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
