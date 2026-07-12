import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";
import { computeMovement } from "../items/movement";
import type { CreateOrderInput, AssignDriverInput, DeliverOrderInput } from "./schemas";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_SERIALIZATION_RETRIES = 3;

export async function createOrder(
  session: SessionPayload,
  input: CreateOrderInput
): Promise<Result<{ orderId: string }>> {
  if (!hasPermission(session, "MANAGE_ORDERS")) {
    return { ok: false, error: "You don't have permission to create orders." };
  }

  const items = await prisma.item.findMany({
    where: { id: { in: input.lineItems.map((li) => li.itemId) }, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(items.map((i) => i.id));
  const invalid = input.lineItems.find((li) => !validIds.has(li.itemId));
  if (invalid) {
    return { ok: false, error: "One or more items in this order no longer exist." };
  }

  const order = await prisma.order.create({
    data: {
      customerName: input.customerName,
      customerAddress: input.customerAddress ?? null,
      customerPhone: input.customerPhone ?? null,
      notes: input.notes ?? null,
      createdById: session.userId,
      lineItems: {
        create: input.lineItems.map((li) => ({ itemId: li.itemId, quantity: li.quantity })),
      },
    },
  });

  return { ok: true, orderId: order.id };
}

export async function assignDriver(
  session: SessionPayload,
  orderId: string,
  input: AssignDriverInput
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_ORDERS")) {
    return { ok: false, error: "You don't have permission to assign drivers." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "DELIVERED" || order.status === "CANCELLED") {
    return { ok: false, error: "Can't reassign a completed or cancelled order." };
  }

  await prisma.order.update({ where: { id: orderId }, data: { driverId: input.driverId } });
  return { ok: true };
}

function canActOnOrder(session: SessionPayload, order: { driverId: string | null }): boolean {
  return hasPermission(session, "MANAGE_ORDERS") || order.driverId === session.userId;
}

export async function markOutForDelivery(session: SessionPayload, orderId: string): Promise<Result> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found." };
  if (!canActOnOrder(session, order)) {
    return { ok: false, error: "You don't have permission to update this order." };
  }
  if (order.status !== "PENDING") {
    return { ok: false, error: "Only a pending order can be marked out for delivery." };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "OUT_FOR_DELIVERY", outForDeliveryAt: new Date() },
  });
  return { ok: true };
}

export async function markDelivered(
  session: SessionPayload,
  orderId: string,
  input: DeliverOrderInput
): Promise<Result> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { ok: false, error: "Order not found." };
  if (!canActOnOrder(session, existing)) {
    return { ok: false, error: "You don't have permission to update this order." };
  }
  if (existing.status !== "OUT_FOR_DELIVERY" && existing.status !== "PENDING") {
    return { ok: false, error: "This order can't be marked delivered from its current status." };
  }

  const paymentByLineItem = new Map(input.payments.map((p) => [p.lineItemId, p]));

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
            include: { lineItems: true },
          });
          if (!order) return { error: "Order not found." } as const;
          if (order.status !== "OUT_FOR_DELIVERY" && order.status !== "PENDING") {
            return { error: "This order can't be marked delivered from its current status." } as const;
          }

          // All-or-nothing: every line item's stock check + write happens in one
          // transaction, same guarantee as a manual stock removal.
          for (const li of order.lineItems) {
            const item = await tx.item.findUnique({ where: { id: li.itemId, deletedAt: null } });
            if (!item) return { error: "One of this order's items no longer exists." } as const;

            const payment = paymentByLineItem.get(li.id);
            const cashAmount = payment?.cashAmount ?? 0;
            const interacAmount = payment?.interacAmount ?? 0;
            const totalPaid = cashAmount + interacAmount;
            const isSale = totalPaid > 0;
            // Same "snapshot what was actually collected" logic as a manual REMOVE —
            // see items/service.ts's adjustStock for the original version of this.
            const effectiveUnitPrice = isSale ? totalPaid / li.quantity : null;
            const currentCost = Number(item.unitCost);

            const movement = computeMovement(item.quantity, {
              type: "REMOVE",
              amount: li.quantity,
              cashAmount,
              interacAmount,
              reason: undefined,
            });
            if (!movement.ok) {
              return { error: `${item.name}: ${movement.error}` } as const;
            }

            await tx.item.update({ where: { id: li.itemId }, data: { quantity: movement.quantityAfter } });
            await tx.movement.create({
              data: {
                itemId: li.itemId,
                type: "REMOVE",
                delta: movement.delta,
                quantityAfter: movement.quantityAfter,
                reason: `Order delivery — ${order.customerName}`,
                isSale,
                cashAmount: isSale ? cashAmount : null,
                interacAmount: isSale ? interacAmount : null,
                unitCostAtTime: isSale ? currentCost : null,
                unitPriceAtTime: effectiveUnitPrice,
                userId: session.userId,
              },
            });
          }

          await tx.order.update({
            where: { id: orderId },
            data: { status: "DELIVERED", deliveredAt: new Date() },
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

  return { ok: false, error: "Could not complete delivery, please try again." };
}

export async function cancelOrder(session: SessionPayload, orderId: string): Promise<Result> {
  if (!hasPermission(session, "MANAGE_ORDERS")) {
    return { ok: false, error: "You don't have permission to cancel orders." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "DELIVERED" || order.status === "CANCELLED") {
    return { ok: false, error: "This order is already completed or cancelled." };
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  return { ok: true };
}

export async function listOrders(session: SessionPayload) {
  const canManage = hasPermission(session, "MANAGE_ORDERS");
  return prisma.order.findMany({
    where: canManage ? {} : { driverId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      lineItems: { include: { item: { select: { id: true, name: true } } } },
      driver: { select: { id: true, name: true } },
    },
  });
}

export async function getOrder(session: SessionPayload, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      lineItems: { include: { item: { select: { id: true, name: true } } } },
      driver: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!order) return null;
  if (!hasPermission(session, "MANAGE_ORDERS") && order.driverId !== session.userId) return null;
  return order;
}
