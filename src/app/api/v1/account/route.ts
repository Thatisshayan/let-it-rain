import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { updateOwnProfileFormSchema } from "@/app/(app)/settings/schemas";
import { updateOwnProfile } from "@/app/(app)/settings/service";

export async function PATCH(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
}
