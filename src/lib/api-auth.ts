import { NextResponse } from "next/server";
import { verifyBearerToken, type SessionPayload } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";

type Handler<Ctx> = (
  req: Request,
  ctx: Ctx,
  session: SessionPayload
) => Promise<NextResponse> | NextResponse;

/** Wraps an /api/v1 route handler with a bearer-token check. 401s if missing/invalid. */
export function withAuth<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (req: Request, ctx?: Ctx) => {
    const session = await verifyBearerToken(req);
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    return handler(req, ctx as Ctx, session);
  };
}

/** Wraps an /api/v1 route handler with a bearer-token + permission check. 401/403 as appropriate. */
export function withPermission<Ctx = unknown>(perm: Permission, handler: Handler<Ctx>) {
  return withAuth<Ctx>(async (req, ctx, session) => {
    if (!hasPermission(session, perm)) {
      return NextResponse.json(
        { error: "You don't have permission to do that." },
        { status: 403 }
      );
    }
    return handler(req, ctx, session);
  });
}
