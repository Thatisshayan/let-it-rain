import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOrder } from "../service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DriverAssignForm } from "./driver-assign-form";
import { StatusActions } from "./status-actions";
import { DeliverForm } from "./deliver-form";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const order = await getOrder(session, id);
  if (!order) notFound();

  const canManage = hasPermission(session, "MANAGE_ORDERS");
  const isAssignedDriver = order.driverId === session.userId;
  const canAct = canManage || isAssignedDriver;
  const isActive = order.status === "PENDING" || order.status === "OUT_FOR_DELIVERY";

  const drivers = canManage
    ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{order.customerName}</h1>
          {order.customerAddress && <p className="text-sm text-muted-foreground">{order.customerAddress}</p>}
          {order.customerPhone && <p className="text-sm text-muted-foreground">{order.customerPhone}</p>}
        </div>
        <Badge variant={order.status === "CANCELLED" ? "destructive" : order.status === "DELIVERED" ? "default" : "warning"}>
          {STATUS_LABEL[order.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {order.lineItems.map((li) => (
              <li key={li.id} className="flex items-center justify-between py-2 text-sm">
                <span>{li.item.name}</span>
                <span className="tabular-nums text-muted-foreground">× {li.quantity}</span>
              </li>
            ))}
          </ul>
          {order.notes && <p className="mt-3 text-sm text-muted-foreground">{order.notes}</p>}
        </CardContent>
      </Card>

      {canManage && isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Driver</CardTitle>
          </CardHeader>
          <CardContent>
            <DriverAssignForm orderId={order.id} drivers={drivers} currentDriverId={order.driverId} />
          </CardContent>
        </Card>
      )}
      {!canManage && order.driver && (
        <p className="text-sm text-muted-foreground">Assigned to {order.driver.name}</p>
      )}

      {canAct && isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Update status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.status === "PENDING" && <StatusActions orderId={order.id} canCancel={canManage} />}
            {(order.status === "OUT_FOR_DELIVERY" || order.status === "PENDING") && (
              <DeliverForm orderId={order.id} lineItems={order.lineItems.map((li) => ({ id: li.id, itemName: li.item.name }))} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
