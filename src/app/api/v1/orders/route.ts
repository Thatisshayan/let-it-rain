import { NextResponse } from "next/server";
import { withAuth, withPermission } from "@/lib/api-auth";
import { createOrderFormSchema } from "@/app/(app)/orders/schemas";
import { createOrder, listOrders } from "@/app/(app)/orders/service";

export const GET = withAuth(async (_req, _ctx, session) => {
  const orders = await listOrders(session);
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      customerName: o.customerName,
      customerAddress: o.customerAddress,
      customerPhone: o.customerPhone,
      status: o.status,
      notes: o.notes,
      driver: o.driver,
      lineItems: o.lineItems.map((li) => ({
        id: li.id,
        itemId: li.itemId,
        itemName: li.item.name,
        quantity: li.quantity,
      })),
      createdAt: o.createdAt.toISOString(),
      outForDeliveryAt: o.outForDeliveryAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
    })),
  });
});

export const POST = withPermission("MANAGE_ORDERS", async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = createOrderFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const result = await createOrder(session, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ orderId: result.orderId }, { status: 201 });
});
