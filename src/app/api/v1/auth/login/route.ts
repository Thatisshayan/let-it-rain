import { NextResponse } from "next/server";
import { z } from "zod";
import { signSessionToken } from "@/lib/auth";
import { attemptLogin, getClientIp } from "@/lib/login";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  const ip = getClientIp(req.headers);
  const result = await attemptLogin(email, password, ip);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const token = await signSessionToken({
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    permissions: result.user.permissions,
    tokenVersion: result.user.tokenVersion,
  });

  return NextResponse.json({ token, user: result.user });
}
