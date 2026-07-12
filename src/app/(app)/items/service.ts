import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";
import { computeMovement, nextWeightedAverageCost } from "./movement";
import { parseCustomFields } from "./schemas";
import type { z } from "zod";
import type { itemFormSchema, createItemFormSchema, movementFormSchema } from "./schemas";

type ItemFormInput = z.infer<typeof itemFormSchema>;
type CreateItemInput = z.infer<typeof createItemFormSchema>;
type MovementInput = z.infer<typeof movementFormSchema>;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function createItem(
  session: SessionPayload,
  input: CreateItemInput
): Promise<Result<{ itemId: string }>> {
  if (!hasPermission(session, "EDIT_ITEMS")) {
    return { ok: false, error: "You don't have permission to add items." };
  }

  const { name, category, description, location, minStock, initialQuantity, customFields, unitCost, unitPrice } =
    input;

  const item = await prisma.item.create({
    data: {
      name,
      category: category ?? null,
      description: description ?? null,
      location: location ?? null,
      minStock,
      quantity: initialQuantity,
      customFields: parseCustomFields(customFields),
      unitCost,
      unitPrice,
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
        unitCostAtTime: unitCost,
        userId: session.userId,
      },
    });
  }

  return { ok: true, itemId: item.id };
}

export async function updateItem(
  session: SessionPayload,
  itemId: string,
  input: ItemFormInput
): Promise<Result> {
  if (!hasPermission(session, "EDIT_ITEMS")) {
    return { ok: false, error: "You don't have permission to edit items." };
  }

  const { name, category, description, location, minStock, customFields, unitCost, unitPrice } = input;

  await prisma.item.update({
    where: { id: itemId, deletedAt: null },
    data: {
      name,
      category: category ?? null,
      description: description ?? null,
      location: location ?? null,
      minStock,
      customFields: parseCustomFields(customFields),
      unitCost,
      unitPrice,
    },
  });

  return { ok: true };
}

export async function deleteItem(
  session: SessionPayload,
  itemId: string
): Promise<Result> {
  if (!hasPermission(session, "DELETE_ITEMS")) {
    return { ok: false, error: "You don't have permission to delete items." };
  }

  await prisma.item.update({
    where: { id: itemId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return { ok: true };
}

const MAX_SERIALIZATION_RETRIES = 3;

export async function adjustStock(
  session: SessionPayload,
  itemId: string,
  input: MovementInput
): Promise<Result> {
  if (!hasPermission(session, "ADJUST_STOCK")) {
    return { ok: false, error: "You don't have permission to adjust stock." };
  }

  const reason = input.reason ?? null;

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const item = await tx.item.findUnique({ where: { id: itemId, deletedAt: null } });
          if (!item) return { error: "Item not found." } as const;

          const movement = computeMovement(item.quantity, input);
          if (!movement.ok) return { error: movement.error } as const;

          const currentCost = Number(item.unitCost);
          const isReceive = input.type === "RECEIVE";
          const cashAmount = input.type === "REMOVE" ? input.cashAmount : 0;
          const interacAmount = input.type === "REMOVE" ? input.interacAmount : 0;
          const totalPaid = cashAmount + interacAmount;
          const isSale = input.type === "REMOVE" && totalPaid > 0;
          // Snapshot the price actually paid (cash + Interac / units), not the item's
          // current list price — this is the real transaction amount, and keeps
          // totalRevenue's `-delta * unitPriceAtTime` formula exactly equal to what was
          // collected even if it differs from the item's list price.
          const effectiveUnitPrice = isSale ? totalPaid / input.amount : null;
          const receivedCost = isReceive ? (input.unitCost ?? currentCost) : currentCost;
          const newAvgCost = isReceive
            ? nextWeightedAverageCost(item.quantity, currentCost, input.amount, receivedCost)
            : currentCost;

          await tx.item.update({
            where: { id: itemId },
            data: {
              quantity: movement.quantityAfter,
              ...(isReceive ? { unitCost: newAvgCost } : {}),
            },
          });
          await tx.movement.create({
            data: {
              itemId,
              type: input.type,
              delta: movement.delta,
              quantityAfter: movement.quantityAfter,
              reason,
              isSale,
              cashAmount: isSale ? cashAmount : null,
              interacAmount: isSale ? interacAmount : null,
              unitCostAtTime: isReceive ? receivedCost : isSale ? currentCost : null,
              unitPriceAtTime: effectiveUnitPrice,
              userId: session.userId,
            },
          });

          return { error: undefined } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (result.error) return { ok: false, error: result.error };
      return { ok: true };
    } catch (err) {
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isSerializationFailure || attempt === MAX_SERIALIZATION_RETRIES - 1) {
        throw err;
      }
    }
  }

  return { ok: false, error: "Could not save movement, please try again." };
}
