import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { createItemFormSchema } from "@/app/(app)/items/schemas";
import { createItem } from "@/app/(app)/items/service";

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const low = url.searchParams.get("low") === "1";

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
  });

  const filtered = low ? items.filter((i) => i.quantity < i.minStock) : items;

  return NextResponse.json({
    items: filtered.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      minStock: i.minStock,
      unitCost: Number(i.unitCost),
      unitPrice: Number(i.unitPrice),
      lowStock: i.quantity < i.minStock,
    })),
  });
});

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = createItemFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await createItem(session, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ itemId: result.itemId }, { status: 201 });
});
