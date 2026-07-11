import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-auth";
import { setUserActive } from "@/app/(app)/settings/service";

type Ctx = { params: Promise<{ id: string }> };

const activeSchema = z.object({ active: z.boolean() });

export const PATCH = withAuth<Ctx>(async (req, { params }, session) => {
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
});
