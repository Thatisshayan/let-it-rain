import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { movementFormSchema } from "@/app/(app)/items/schemas";
import { adjustStock } from "@/app/(app)/items/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAuth<Ctx>(async (req, { params }, session) => {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = movementFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await adjustStock(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission")
      ? 403
      : result.error.includes("try again")
        ? 409
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
});
