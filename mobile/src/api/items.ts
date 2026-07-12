import { apiFetch } from "./client";

export type Item = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  minStock: number;
  unitCost: number;
  unitPrice: number;
  lowStock: boolean;
};

export type Movement = {
  id: string;
  type: "RECEIVE" | "REMOVE" | "ADJUST";
  delta: number;
  quantityAfter: number;
  reason: string | null;
  isSale: boolean;
  cashAmount: number | null;
  interacAmount: number | null;
  createdAt: string;
  user: { name: string };
};

export type ItemDetail = Omit<Item, "lowStock"> & {
  description: string | null;
  location: string | null;
  customFields: unknown;
};

export async function fetchItems(params: { q?: string; low?: boolean } = {}): Promise<Item[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.low) qs.set("low", "1");
  const { items } = await apiFetch<{ items: Item[] }>(`/api/v1/items?${qs.toString()}`);
  return items;
}

export async function fetchItem(id: string): Promise<{ item: ItemDetail; movements: Movement[] }> {
  return apiFetch(`/api/v1/items/${id}`);
}

export async function createItem(input: {
  name: string;
  category?: string;
  description?: string;
  location?: string;
  minStock: number;
  initialQuantity: number;
  unitCost: number;
  unitPrice: number;
}): Promise<{ itemId: string }> {
  return apiFetch("/api/v1/items", { method: "POST", body: JSON.stringify(input) });
}

export async function updateItem(
  id: string,
  input: {
    name: string;
    category?: string;
    description?: string;
    location?: string;
    minStock: number;
    unitCost: number;
    unitPrice: number;
  }
): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/items/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function adjustStock(
  id: string,
  input:
    | { type: "RECEIVE"; amount: number; unitCost?: number; reason?: string }
    | { type: "REMOVE"; amount: number; cashAmount?: number; interacAmount?: number; reason?: string }
    | { type: "ADJUST"; counted: number; reason?: string }
): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/items/${id}/movements`, { method: "POST", body: JSON.stringify(input) });
}
