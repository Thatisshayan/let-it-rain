import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

const TOKEN_KEY = "litr_token";
const REQUEST_TIMEOUT_MS = 15_000;

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      0,
      "The app isn't configured with an API server address (EXPO_PUBLIC_API_BASE_URL is missing)."
    );
  }

  const token = await getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(0, "The request timed out. Check your connection and try again.");
    }
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  const body = await res.json().catch(() => ({}));

  const isLoginRequest = path.startsWith("/api/v1/auth/login");
  if (res.status === 401 && !isLoginRequest) {
    await clearToken();
    router.replace("/login");
    throw new ApiError(401, body.error ?? "Your session has expired. Please sign in again.");
  }

  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "Something went wrong.");
  }

  return body as T;
}
