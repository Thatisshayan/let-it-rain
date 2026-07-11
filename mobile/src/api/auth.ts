import { apiFetch, setToken, clearToken } from "./client";

export type User = { id: string; email: string; name: string; permissions: string[] };

export async function login(email: string, password: string): Promise<User> {
  const { token, user } = await apiFetch<{ token: string; user: User }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await setToken(token);
  return user;
}

export async function logout(): Promise<void> {
  await apiFetch("/api/v1/auth/logout", { method: "POST" });
  await clearToken();
}
