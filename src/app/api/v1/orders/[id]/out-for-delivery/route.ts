import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { markOutForDelivery } from "@/app/(app)/orders/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAuth<Ctx>(async (_req, { params }, session) => {
  const { id } = await params;
  const result = await markOutForDelivery(session, id);
  if (!result.ok) {
    const status = result.error.includes("permission")
      ? 403
      : result.error.includes("not found")
        ? 404
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
});
