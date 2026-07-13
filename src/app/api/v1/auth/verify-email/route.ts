import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailToken } from "@/lib/signup";

// Phase 13d: confirm a signup's email via the single-use token.
const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A verification token is required." }, { status: 400 });
  }
  const result = await verifyEmailToken(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, organizationId: result.organizationId });
}
