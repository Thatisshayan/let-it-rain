import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearerToken } from "@/lib/auth";
import { setUserActive } from "@/app/(app)/settings/service";

type Ctx = { params: Promise<{ id: string }> };

const activeSchema = z.object({ active: z.boolean() });

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = activeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const result = await setUserActive(session, id, parsed.data.active);
  if (!result.ok) {
    const status = result.error.includes("permission to manage") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
