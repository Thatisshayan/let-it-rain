import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("expo-local-authentication", () => ({
  isAvailableAsync: vi.fn(() => Promise.resolve(true)),
  authenticateAsync: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

vi.mock("../api/orders", () => ({
  markOutForDelivery: vi.fn(),
  markDelivered: vi.fn(),
}));

describe("Mobile App — Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function base64UrlEncode(json: unknown): string {
    return Buffer.from(JSON.stringify(json))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  describe("JWT utilities", () => {
    it("decodeJwtPayload decodes a well-formed token", async () => {
      const { decodeJwtPayload } = await import("../api/jwt");
      const payload = {
        userId: "u1",
        email: "a@b.com",
        name: "Alice",
        permissions: ["EDIT_ITEMS"],
      };
      const token = `${base64UrlEncode({ alg: "HS256", typ: "JWT" })}.${base64UrlEncode(payload)}.sig`;
      expect(decodeJwtPayload(token)).toEqual(payload);
    });

    it("decodeJwtPayload returns null for malformed token", async () => {
      const { decodeJwtPayload } = await import("../api/jwt");
      expect(decodeJwtPayload("not-a-jwt")).toBeNull();
      expect(decodeJwtPayload("")).toBeNull();
    });

    it("isTokenExpired returns true for past exp", async () => {
      const { isTokenExpired } = await import("../api/jwt");
      const past = Math.floor(Date.now() / 1000) - 60;
      expect(isTokenExpired({ userId: "u1", email: "a@b.com", name: "A", permissions: [], exp: past })).toBe(true);
    });

    it("isTokenExpired returns false for future exp", async () => {
      const { isTokenExpired } = await import("../api/jwt");
      const future = Math.floor(Date.now() / 1000) + 3600;
      expect(isTokenExpired({ userId: "u1", email: "a@b.com", name: "A", permissions: [], exp: future })).toBe(false);
    });
  });

  describe("Offline queue", () => {
    it("enqueues and persists a delivery action", async () => {
      const secureStore = await import("expo-secure-store");
      const queueModule = await import("../offlineQueue");
      const action = { orderId: "o1", type: "out_for_delivery" as const };

      await queueModule.enqueueOrderAction(action);

      expect(secureStore.setItemAsync).toHaveBeenCalledWith(
        "litr_order_action_queue",
        expect.stringContaining("out_for_delivery")
      );
    });

    it("flushOrderActionQueue returns empty when no queue stored", async () => {
      const secureStore = await import("expo-secure-store");
      (secureStore.getItemAsync as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const queueModule = await import("../offlineQueue");
      const result = await queueModule.flushOrderActionQueue();

      expect(result).toEqual({ flushed: 0, remaining: 0 });
    });

    it("getQueueLength returns correct count", async () => {
      const secureStore = await import("expo-secure-store");
      const items = [
        { orderId: "o1", type: "out_for_delivery", id: "o1-ofd-1" },
        { orderId: "o1", type: "deliver", id: "o1-del-1", payments: [] },
      ];
      (secureStore.getItemAsync as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(items));

      const queueModule = await import("../offlineQueue");
      const len = await queueModule.getQueueLength();

      expect(len).toBe(2);
    });
  });

  describe("JWT decode + expiry composition", () => {
    it("future token returns not expired", async () => {
      const { decodeJwtPayload, isTokenExpired } = await import("../api/jwt");
      const future = Math.floor(Date.now() / 1000) + 3600;
      const body = { userId: "u1", email: "a@b.com", name: "A", permissions: [], exp: future };
      const token = `${base64UrlEncode({ alg: "HS256" })}.${base64UrlEncode(body)}.sig`;

      const decoded = decodeJwtPayload(token);
      expect(decoded).not.toBeNull();
      expect(isTokenExpired(decoded!)).toBe(false);
    });

    it("past token returns expired", async () => {
      const { decodeJwtPayload, isTokenExpired } = await import("../api/jwt");
      const past = Math.floor(Date.now() / 1000) - 60;
      const body = { userId: "u1", email: "a@b.com", name: "A", permissions: [], exp: past };
      const token = `${base64UrlEncode({ alg: "HS256" })}.${base64UrlEncode(body)}.sig`;

      const decoded = decodeJwtPayload(token);
      expect(decoded).not.toBeNull();
      expect(isTokenExpired(decoded!)).toBe(true);
    });
  });
});
