import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { updateOwnProfileFormSchema } from "@/app/(app)/settings/schemas";
import { updateOwnProfile } from "@/app/(app)/settings/service";

export const PATCH = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = updateOwnProfileFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await updateOwnProfile(session, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
});
