import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { toCsv } from "@/lib/csv";

export const GET = withAuth(async () => {
  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { name: true, category: true, quantity: true, minStock: true },
  });

  const rows = [
    ["Name", "Category", "Quantity", "Min stock"],
    ...items.map((i) => [i.name, i.category ?? "", String(i.quantity), String(i.minStock)]),
  ];

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inventory.csv"',
    },
  });
});
