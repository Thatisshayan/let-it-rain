import { NextResponse } from "next/server";
import { withAuth, withPermission } from "@/lib/api-auth";
import { orgSettingsFormSchema } from "@/app/(app)/settings/schemas";
import { getOrgSettings, updateOrgSettings } from "@/app/(app)/settings/service";

// Phase 13c: org-level settings API. Org is always session-derived; a caller can
// only ever read/write their own org's AppConfig.
export const GET = withAuth(async (_req, _ctx, session) => {
  const settings = await getOrgSettings(session);
  return NextResponse.json({ settings });
});

export const PATCH = withPermission("MANAGE_SETTINGS", async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = orgSettingsFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const result = await updateOrgSettings(session, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
});
