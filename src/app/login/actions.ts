"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { attemptLogin, getClientIp } from "@/lib/login";

export type LoginState = {
  error?: string;
};

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().min(1).max(320)),
  password: z.string().min(1).max(200),
});

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Email and password are required." };
  }
  const { email, password } = parsed.data;

  const ip = getClientIp(await headers());
  const result = await attemptLogin(email, password, ip);
  if (!result.ok) {
    return { error: result.error };
  }

  await createSession({
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    permissions: result.user.permissions,
    tokenVersion: result.user.tokenVersion,
  });
  redirect("/");
}
