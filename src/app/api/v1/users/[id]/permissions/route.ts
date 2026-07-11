import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { updatePermissionsFormSchema } from "@/app/(app)/settings/schemas";
import { updateUserPermissions } from "@/app/(app)/settings/service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<Ctx>(async (req, { params }, session) => {
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
});
