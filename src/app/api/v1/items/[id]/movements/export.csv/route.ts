import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { toCsv } from "@/lib/csv";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (_req, { params }) => {
  const { id } = await params;

  const item = await prisma.item.findUnique({ where: { id }, select: { name: true } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const movements = await prisma.movement.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  const rows = [
    ["Date", "Type", "Delta", "Quantity after", "User", "Reason"],
    ...movements.map((m) => [
      m.createdAt.toISOString(),
      m.type,
      String(m.delta),
      String(m.quantityAfter),
      m.user.name,
      m.reason ?? "",
    ]),
  ];

  const safeName = item.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-movements.csv"`,
    },
  });
});
