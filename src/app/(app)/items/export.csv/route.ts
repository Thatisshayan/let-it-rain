import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.item.findMany({
    where: { deletedAt: null, organizationId: session.organizationId },
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
}
