"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createItemFormSchema, itemFormSchema, movementFormSchema } from "./schemas";
import { createItem, updateItem, deleteItem, adjustStock } from "./service";

export type ActionState = {
  error?: string;
};

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = createItemFormSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    minStock: formData.get("minStock"),
    initialQuantity: formData.get("initialQuantity"),
    customFields: formData.get("customFields"),
    unitCost: formData.get("unitCost"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await createItem(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/items");
  redirect(`/items/${result.itemId}`);
}

export async function updateItemAction(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = itemFormSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    minStock: formData.get("minStock"),
    customFields: formData.get("customFields"),
    unitCost: formData.get("unitCost"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await updateItem(session, itemId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  redirect(`/items/${itemId}`);
}

export async function deleteItemAction(itemId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await deleteItem(session, itemId);
  if (!result.ok) redirect(`/items/${itemId}?error=forbidden`);

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

  const parsed = movementFormSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    counted: formData.get("counted"),
    unitCost: formData.get("unitCost"),
    cashAmount: formData.get("cashAmount"),
    interacAmount: formData.get("interacAmount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await adjustStock(session, itemId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/items/${itemId}`);
  revalidatePath("/items");
  revalidatePath("/");
  return {};
}
