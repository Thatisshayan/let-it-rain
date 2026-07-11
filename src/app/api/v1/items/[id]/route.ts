import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { itemFormSchema } from "@/app/(app)/items/schemas";
import { updateItem, deleteItem } from "@/app/(app)/items/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id, deletedAt: null } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const movements = await prisma.movement.findMany({
    where: { itemId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: { name: true } } },
    take: 20,
  });

  return NextResponse.json({
    item: {
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      minStock: item.minStock,
      unitCost: Number(item.unitCost),
      unitPrice: Number(item.unitPrice),
      customFields: item.customFields,
    },
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      delta: m.delta,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      isSale: m.isSale,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
  });
});

export const PATCH = withAuth<Ctx>(async (req, { params }, session) => {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = itemFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await updateItem(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth<Ctx>(async (_req, { params }, session) => {
  const { id } = await params;
  const result = await deleteItem(session, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });

  return NextResponse.json({ ok: true });
});
