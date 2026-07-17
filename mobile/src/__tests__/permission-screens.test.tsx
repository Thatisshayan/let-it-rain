import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: { replace: vi.fn(), back: vi.fn(), push: vi.fn() },
}));

vi.mock("@sentry/react-native", () => ({
  addBreadcrumb: vi.fn(),
}));

describe("mobile api client behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("clears the token and redirects to login on 401 JSON responses", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.test");
    const secureStore = await import("expo-secure-store");
    const { router } = await import("expo-router");
    (secureStore.getItemAsync as any).mockResolvedValue("jwt-token");
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "expired" }),
    });

    const { apiFetch } = await import("../api/client");

    await expect(apiFetch("/api/v1/items")).rejects.toMatchObject({
      status: 401,
      message: "expired",
    });
    expect(secureStore.deleteItemAsync).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/login");
  });

  it("does not redirect on 401 from the login endpoint", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.test");
    const secureStore = await import("expo-secure-store");
    const { router } = await import("expo-router");
    (secureStore.getItemAsync as any).mockResolvedValue(null);
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "invalid credentials" }),
    });

    const { apiFetch } = await import("../api/client");

    await expect(
      apiFetch("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "a", password: "b" }) })
    ).rejects.toMatchObject({
      status: 401,
      message: "invalid credentials",
    });
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("throws a clear configuration error when EXPO_PUBLIC_API_BASE_URL is missing", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    const { apiFetch } = await import("../api/client");

    await expect(apiFetch("/api/v1/items")).rejects.toMatchObject({
      status: 0,
      message: "The app isn't configured with an API server address (EXPO_PUBLIC_API_BASE_URL is missing).",
    });
  });
});
