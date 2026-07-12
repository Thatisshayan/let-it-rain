"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  createOrderFormSchema,
  assignDriverFormSchema,
  deliverOrderFormSchema,
} from "./schemas";
import {
  createOrder,
  assignDriver,
  markOutForDelivery,
  markDelivered,
  cancelOrder,
} from "./service";

export type ActionState = {
  error?: string;
};

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createOrderAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const lineItems: { itemId: string; quantity: number }[] = [];
  const itemIds = formData.getAll("lineItemId[]");
  const quantities = formData.getAll("lineItemQuantity[]");
  itemIds.forEach((itemId, i) => {
    if (typeof itemId === "string" && itemId) {
      lineItems.push({ itemId, quantity: Number(quantities[i]) || 0 });
    }
  });

  const parsed = createOrderFormSchema.safeParse({
    customerName: formData.get("customerName"),
    customerAddress: formData.get("customerAddress"),
    customerPhone: formData.get("customerPhone"),
    notes: formData.get("notes"),
    lineItems,
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await createOrder(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/orders");
  redirect(`/orders/${result.orderId}`);
}

export async function assignDriverAction(orderId: string, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const raw = formData.get("driverId");
  const parsed = assignDriverFormSchema.safeParse({ driverId: raw === "" ? null : raw });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await assignDriver(session, orderId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return {};
}

export async function markOutForDeliveryAction(orderId: string): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await markOutForDelivery(session, orderId);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return {};
}

export async function markDeliveredAction(
  orderId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const lineItemIds = formData.getAll("lineItemId[]");
  const cashAmounts = formData.getAll("cashAmount[]");
  const interacAmounts = formData.getAll("interacAmount[]");
  const payments = lineItemIds.map((lineItemId, i) => ({
    lineItemId: String(lineItemId),
    cashAmount: cashAmounts[i],
    interacAmount: interacAmounts[i],
  }));

  const parsed = deliverOrderFormSchema.safeParse({ payments });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await markDelivered(session, orderId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/items");
  revalidatePath("/reports");
  revalidatePath("/");
  return {};
}

export async function cancelOrderAction(orderId: string): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await cancelOrder(session, orderId);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return {};
}
