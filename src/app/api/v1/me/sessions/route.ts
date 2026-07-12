import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { revokeUserSessions } from "@/app/(app)/accounts/service";

export const POST = withAuth(async (_, __, session) => {
  const result = await revokeUserSessions(session, session.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
});