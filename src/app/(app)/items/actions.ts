"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  createItemFormSchema,
  itemFormSchema,
  movementFormSchema,
  parseCustomFields,
} from "./schemas";
import { computeMovement } from "./movement";

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
  if (!hasPermission(session, "EDIT_ITEMS")) {
    return { error: "You don't have permission to add items." };
  }

  const parsed = createItemFormSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    minStock: formData.get("minStock"),
    initialQuantity: formData.get("initialQuantity"),
    customFields: formData.get("customFields"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const { name, category, description, minStock, initialQuantity, customFields } = parsed.data;

  const item = await prisma.item.create({
    data: {
      name,
      category: category ?? null,
      description: description ?? null,
      minStock,
      quantity: initialQuantity,
      customFields: parseCustomFields(customFields),
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
  if (!hasPermission(session, "EDIT_ITEMS")) {
    return { error: "You don't have permission to edit items." };
  }

  const parsed = itemFormSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    minStock: formData.get("minStock"),
    customFields: formData.get("customFields"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const { name, category, description, minStock, customFields } = parsed.data;

  await prisma.item.update({
    where: { id: itemId, deletedAt: null },
    data: {
      name,
      category: category ?? null,
      description: description ?? null,
      minStock,
      customFields: parseCustomFields(customFields),
    },
  });

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  redirect(`/items/${itemId}`);
}

export async function deleteItemAction(itemId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "DELETE_ITEMS")) {
    redirect(`/items/${itemId}?error=forbidden`);
  }

  // Soft delete: preserves movement history for audit purposes instead of
  // cascading it away.
  await prisma.item.update({
    where: { id: itemId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/items");
  redirect("/items");
}

const MAX_SERIALIZATION_RETRIES = 3;

export async function adjustStockAction(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "ADJUST_STOCK")) {
    return { error: "You don't have permission to adjust stock." };
  }

  const parsed = movementFormSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    counted: formData.get("counted"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const input = parsed.data;
  const reason = input.reason ?? null;

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const item = await tx.item.findUnique({ where: { id: itemId, deletedAt: null } });
          if (!item) return { error: "Item not found." } as const;

          const movement = computeMovement(item.quantity, input);
          if (!movement.ok) return { error: movement.error } as const;

          await tx.item.update({
            where: { id: itemId },
            data: { quantity: movement.quantityAfter },
          });
          await tx.movement.create({
            data: {
              itemId,
              type: input.type,
              delta: movement.delta,
              quantityAfter: movement.quantityAfter,
              reason,
              userId: session.userId,
            },
          });

          return { error: undefined } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (result.error) return { error: result.error };

      revalidatePath(`/items/${itemId}`);
      revalidatePath("/items");
      revalidatePath("/");
      return {};
    } catch (err) {
      // Postgres aborts one side of a conflicting concurrent transaction
      // under SERIALIZABLE isolation (error code 40001) — retry it rather
      // than losing the update.
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isSerializationFailure || attempt === MAX_SERIALIZATION_RETRIES - 1) {
        throw err;
      }
    }
  }

  return { error: "Could not save movement, please try again." };
}
