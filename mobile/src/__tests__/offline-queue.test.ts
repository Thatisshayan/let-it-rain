import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secureStoreMocks = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const orderApiMocks = vi.hoisted(() => ({
  markOutForDelivery: vi.fn(),
  markDelivered: vi.fn(),
}));

const appStateMocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
}));

vi.mock("expo-secure-store", () => secureStoreMocks);
vi.mock("../api/orders", () => orderApiMocks);
vi.mock("react-native", () => ({
  AppState: appStateMocks,
}));

let stopAutoFlush: (() => void) | null = null;

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  secureStoreMocks.getItemAsync.mockResolvedValue(null);
  secureStoreMocks.setItemAsync.mockResolvedValue(undefined);
  secureStoreMocks.deleteItemAsync.mockResolvedValue(undefined);
  orderApiMocks.markOutForDelivery.mockResolvedValue(undefined);
  orderApiMocks.markDelivered.mockResolvedValue(undefined);
  appStateMocks.addEventListener.mockReturnValue({ remove: vi.fn() });
});

afterEach(() => {
  stopAutoFlush?.();
  stopAutoFlush = null;
});

describe("offline queue", () => {
  it("flushes queued actions and clears persisted storage when all succeed", async () => {
    secureStoreMocks.getItemAsync.mockResolvedValue(
      JSON.stringify([
        { id: "a1", orderId: "o1", type: "out_for_delivery" },
        {
          id: "a2",
          orderId: "o2",
          type: "deliver",
          payments: [{ lineItemId: "li-1", cashAmount: 10, interacAmount: 5 }],
        },
      ])
    );

    const { flushOrderActionQueue } = await import("../offlineQueue");
    const result = await flushOrderActionQueue();

    expect(orderApiMocks.markOutForDelivery).toHaveBeenCalledWith("o1");
    expect(orderApiMocks.markDelivered).toHaveBeenCalledWith("o2", [
      { lineItemId: "li-1", cashAmount: 10, interacAmount: 5 },
    ]);
    expect(secureStoreMocks.deleteItemAsync).toHaveBeenCalledWith("litr_order_action_queue");
    expect(result).toEqual({ flushed: 2, remaining: 0 });
  });

  it("keeps failed actions queued for the next retry", async () => {
    orderApiMocks.markOutForDelivery.mockRejectedValue(new Error("offline"));
    secureStoreMocks.getItemAsync.mockResolvedValue(
      JSON.stringify([
        { id: "a1", orderId: "o1", type: "out_for_delivery" },
        {
          id: "a2",
          orderId: "o2",
          type: "deliver",
          payments: [{ lineItemId: "li-2", cashAmount: 0, interacAmount: 20 }],
        },
      ])
    );

    const { flushOrderActionQueue } = await import("../offlineQueue");
    const result = await flushOrderActionQueue();

    expect(orderApiMocks.markDelivered).toHaveBeenCalledWith("o2", [
      { lineItemId: "li-2", cashAmount: 0, interacAmount: 20 },
    ]);
    expect(secureStoreMocks.setItemAsync).toHaveBeenCalledWith(
      "litr_order_action_queue",
      expect.stringContaining("\"orderId\":\"o1\"")
    );
    expect(result).toEqual({ flushed: 1, remaining: 1 });
  });

  it("flushes on foreground resume and avoids registering duplicate auto-flush loops", async () => {
    secureStoreMocks.getItemAsync.mockResolvedValue(
      JSON.stringify([{ id: "a1", orderId: "o1", type: "out_for_delivery" }])
    );

    const { startOrderQueueAutoFlush, stopOrderQueueAutoFlush } = await import("../offlineQueue");
    stopAutoFlush = stopOrderQueueAutoFlush;
    const onFlushed = vi.fn();

    startOrderQueueAutoFlush(onFlushed);
    startOrderQueueAutoFlush(onFlushed);

    expect(appStateMocks.addEventListener).toHaveBeenCalledTimes(1);

    const handleAppStateChange = appStateMocks.addEventListener.mock.calls[0]?.[1];
    handleAppStateChange?.("active");
    await flushEffects();

    expect(orderApiMocks.markOutForDelivery).toHaveBeenCalledWith("o1");
    expect(onFlushed).toHaveBeenCalledWith(1);
  });
});
