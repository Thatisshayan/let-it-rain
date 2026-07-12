import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { markOutForDelivery, markDelivered } from "./api/orders";

const QUEUE_KEY = "litr_order_action_queue";
const RETRY_INTERVAL_MS = 15_000;

type NewQueuedAction =
  | { orderId: string; type: "out_for_delivery" }
  | {
      orderId: string;
      type: "deliver";
      payments: { lineItemId: string; cashAmount: number; interacAmount: number }[];
    };

type QueuedAction = NewQueuedAction & { id: string };

async function readQueue(): Promise<QueuedAction[]> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedAction[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedAction[]): Promise<void> {
  if (queue.length === 0) {
    await SecureStore.deleteItemAsync(QUEUE_KEY);
  } else {
    await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
  }
}

/** Persists a delivery action locally so it can be retried once back online. */
export async function enqueueOrderAction(action: NewQueuedAction): Promise<void> {
  const queue = await readQueue();
  queue.push({ ...action, id: `${action.orderId}-${action.type}-${Date.now()}` });
  await writeQueue(queue);
}

export async function getQueuedActionsForOrder(orderId: string): Promise<QueuedAction[]> {
  const queue = await readQueue();
  return queue.filter((a) => a.orderId === orderId);
}

export async function getQueueLength(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Attempts every queued action against the real API. Actions that fail again
 * (still offline, or a real rejection) stay queued for the next retry —
 * this is a best-effort at-least-once retry, not exactly-once; the delivery
 * endpoints are idempotent-ish in practice (re-marking an already-delivered
 * order just returns an error the second time, it doesn't double-decrement
 * stock, since the service checks the order's current status first).
 */
export async function flushOrderActionQueue(): Promise<{ flushed: number; remaining: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const stillQueued: QueuedAction[] = [];
  let flushed = 0;
  for (const action of queue) {
    try {
      if (action.type === "out_for_delivery") {
        await markOutForDelivery(action.orderId);
      } else {
        await markDelivered(action.orderId, action.payments);
      }
      flushed++;
    } catch {
      stillQueued.push(action);
    }
  }
  await writeQueue(stillQueued);
  return { flushed, remaining: stillQueued.length };
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/** Starts polling the queue every 15s, plus once whenever the app comes to the foreground. */
export function startOrderQueueAutoFlush(onFlushed?: (flushedCount: number) => void): void {
  if (intervalHandle) return;

  const tick = async () => {
    const { flushed } = await flushOrderActionQueue();
    if (flushed > 0) onFlushed?.(flushed);
  };

  intervalHandle = setInterval(tick, RETRY_INTERVAL_MS);
  appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") tick();
  });
}

export function stopOrderQueueAutoFlush(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}
