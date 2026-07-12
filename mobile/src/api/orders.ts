import { apiFetch } from "./client";

export type OrderStatus = "PENDING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export type OrderLineItem = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
};

export type Order = {
  id: string;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  notes: string | null;
  driver: { id: string; name: string } | null;
  lineItems: OrderLineItem[];
  createdAt: string;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
};

export type OrderDetail = Order & { createdBy: { id: string; name: string } };

export async function fetchDrivers(): Promise<{ id: string; name: string }[]> {
  const { drivers } = await apiFetch<{ drivers: { id: string; name: string }[] }>(
    "/api/v1/orders/drivers"
  );
  return drivers;
}

export async function fetchOrders(): Promise<Order[]> {
  const { orders } = await apiFetch<{ orders: Order[] }>("/api/v1/orders");
  return orders;
}

export async function fetchOrder(id: string): Promise<OrderDetail> {
  const { order } = await apiFetch<{ order: OrderDetail }>(`/api/v1/orders/${id}`);
  return order;
}

export async function createOrder(input: {
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  notes?: string;
  lineItems: { itemId: string; quantity: number }[];
}): Promise<{ orderId: string }> {
  return apiFetch("/api/v1/orders", { method: "POST", body: JSON.stringify(input) });
}

export async function assignDriver(orderId: string, driverId: string | null): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/orders/${orderId}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ driverId }),
  });
}

export async function markOutForDelivery(orderId: string): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/orders/${orderId}/out-for-delivery`, { method: "POST" });
}

export async function markDelivered(
  orderId: string,
  payments: { lineItemId: string; cashAmount: number; interacAmount: number }[]
): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/orders/${orderId}/deliver`, {
    method: "POST",
    body: JSON.stringify({ payments }),
  });
}

export async function cancelOrder(orderId: string): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/orders/${orderId}/cancel`, { method: "POST" });
}
