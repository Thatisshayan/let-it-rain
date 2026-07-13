"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export type MovementRow = {
  id: string;
  type: string;
  delta: number;
  quantityAfter: number;
  reason: string | null;
  isSale: boolean;
  cashAmount: number | null;
  interacAmount: number | null;
  unitCostAtTime: number | null;
  unitPriceAtTime: number | null;
  createdAt: string;
  user: { name: string };
};

const PAGE_SIZE = 20;

export async function loadMoreMovementsAction(
  itemId: string,
  cursor: { createdAt: string; id: string } | null
): Promise<{ movements: MovementRow[]; nextCursor: { createdAt: string; id: string } | null }> {
  const session = await getSession();
  if (!session) return { movements: [], nextCursor: null };

  const movements = await prisma.movement.findMany({
    where: {
      itemId,
      organizationId: session.organizationId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: { name: true } } },
    take: PAGE_SIZE,
  });

  const last = movements[movements.length - 1];
  const nextCursor =
    movements.length === PAGE_SIZE && last
      ? { createdAt: last.createdAt.toISOString(), id: last.id }
      : null;

  return {
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      delta: m.delta,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      isSale: m.isSale,
      cashAmount: m.cashAmount ? Number(m.cashAmount) : null,
      interacAmount: m.interacAmount ? Number(m.interacAmount) : null,
      unitCostAtTime: m.unitCostAtTime ? Number(m.unitCostAtTime) : null,
      unitPriceAtTime: m.unitPriceAtTime ? Number(m.unitPriceAtTime) : null,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
    nextCursor,
  };
}
