import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { deliverOrderFormSchema } from "@/app/(app)/orders/schemas";
import { markDelivered } from "@/app/(app)/orders/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAuth<Ctx>(async (req, { params }, session) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({ payments: [] }));
  const parsed = deliverOrderFormSchema.safeParse(body ?? { payments: [] });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await markDelivered(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission")
      ? 403
      : result.error.includes("not found")
        ? 404
        : result.error.includes("try again")
          ? 409
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
});
