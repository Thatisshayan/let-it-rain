import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const item = await prisma.item.findUnique({ where: { id, organizationId: session.organizationId }, select: { name: true } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const movements = await prisma.movement.findMany({
    where: { itemId: id, organizationId: session.organizationId },
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
}
