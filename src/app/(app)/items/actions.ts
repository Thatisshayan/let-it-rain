"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export type ActionState = {
  error?: string;
};

function parseCustomFields(raw: string | null): Record<string, string> | undefined {
  if (!raw || !raw.trim()) return undefined;
  const entries: [string, string][] = [];
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) entries.push([key, value]);
  }
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function createItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Item name is required." };

  const category = String(formData.get("category") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const minStock = Number(formData.get("minStock") ?? 0) || 0;
  const initialQuantity = Number(formData.get("initialQuantity") ?? 0) || 0;
  const customFields = parseCustomFields(formData.get("customFields") as string | null);

  const item = await prisma.item.create({
    data: {
      name,
      category,
      description,
      minStock,
      quantity: initialQuantity,
      customFields,
    },
  });

  if (initialQuantity > 0) {
    await prisma.movement.create({
      data: {
        itemId: item.id,
        type: "RECEIVE",
        delta: initialQuantity,
        quantityAfter: initialQuantity,
        reason: "Initial stock",
        userId: session.userId,
      },
    });
  }

  revalidatePath("/items");
  redirect(`/items/${item.id}`);
}

export async function updateItemAction(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Item name is required." };

  const category = String(formData.get("category") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const minStock = Number(formData.get("minStock") ?? 0) || 0;
  const customFields = parseCustomFields(formData.get("customFields") as string | null);

  await prisma.item.update({
    where: { id: itemId },
    data: { name, category, description, minStock, customFields },
  });

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  redirect(`/items/${itemId}`);
}

export async function deleteItemAction(itemId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  await prisma.item.delete({ where: { id: itemId } });
  revalidatePath("/items");
  redirect("/items");
}

export async function adjustStockAction(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const type = String(formData.get("type") ?? "") as "RECEIVE" | "REMOVE" | "ADJUST";
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found." };

  let delta = 0;
  let quantityAfter = item.quantity;

  if (type === "RECEIVE") {
    const amount = Number(formData.get("amount") ?? 0);
    if (!amount || amount <= 0) return { error: "Enter a positive quantity to receive." };
    delta = amount;
    quantityAfter = item.quantity + amount;
  } else if (type === "REMOVE") {
    const amount = Number(formData.get("amount") ?? 0);
    if (!amount || amount <= 0) return { error: "Enter a positive quantity to remove." };
    if (amount > item.quantity) return { error: "Cannot remove more than current stock." };
    delta = -amount;
    quantityAfter = item.quantity - amount;
  } else if (type === "ADJUST") {
    const counted = Number(formData.get("counted") ?? NaN);
    if (Number.isNaN(counted) || counted < 0) return { error: "Enter a valid counted quantity." };
    delta = counted - item.quantity;
    quantityAfter = counted;
    if (delta !== 0 && !reason) {
      return { error: "Please note a reason for the count variance." };
    }
  } else {
    return { error: "Invalid movement type." };
  }

  await prisma.$transaction([
    prisma.item.update({ where: { id: itemId }, data: { quantity: quantityAfter } }),
    prisma.movement.create({
      data: {
        itemId,
        type,
        delta,
        quantityAfter,
        reason,
        userId: session.userId,
      },
    }),
  ]);

  revalidatePath(`/items/${itemId}`);
  revalidatePath("/items");
  revalidatePath("/");
  return {};
}
