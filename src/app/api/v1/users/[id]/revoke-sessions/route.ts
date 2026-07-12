import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { revokeUserSessions } from "@/app/(app)/accounts/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAuth<Ctx>(async (_req, { params }, session) => {
  const { id } = await params;
  const result = await revokeUserSessions(session, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
});