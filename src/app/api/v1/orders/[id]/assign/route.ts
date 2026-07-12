import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api-auth";
import { assignDriverFormSchema } from "@/app/(app)/orders/schemas";
import { assignDriver } from "@/app/(app)/orders/service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withPermission<Ctx>("MANAGE_ORDERS", async (req, { params }, session) => {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = assignDriverFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await assignDriver(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
});
