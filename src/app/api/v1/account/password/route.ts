import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { changeOwnPasswordFormSchema } from "@/app/(app)/settings/schemas";
import { changeOwnPassword } from "@/app/(app)/settings/service";

export async function POST(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = changeOwnPasswordFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await changeOwnPassword(session, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
