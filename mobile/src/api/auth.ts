import { apiFetch, setToken } from "./client";

// Phase 13a: the API now returns the user's organizationId (derived server-side
// from the authenticated user). Mobile is a pure client of the org-scoped API —
// it does no tenant filtering itself — but carries the id so it isn't painted
// into a corner for 13b/13c (e.g. org-scoped push/Sentry context). Optional so
// tokens issued before this change still decode cleanly.
export type User = { id: string; email: string; name: string; permissions: string[]; organizationId?: string };

export async function login(email: string, password: string): Promise<User> {
  const { token, user } = await apiFetch<{ token: string; user: User }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await setToken(token);
  return user;
}
