import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getOrder } from "@/app/(app)/orders/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (_req, { params }, session) => {
  const { id } = await params;
  const order = await getOrder(session, id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  return NextResponse.json({
    order: {
      id: order.id,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      customerPhone: order.customerPhone,
      status: order.status,
      notes: order.notes,
      driver: order.driver,
      createdBy: order.createdBy,
      lineItems: order.lineItems.map((li) => ({
        id: li.id,
        itemId: li.itemId,
        itemName: li.item.name,
        quantity: li.quantity,
      })),
      createdAt: order.createdAt.toISOString(),
      outForDeliveryAt: order.outForDeliveryAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
    },
  });
});
