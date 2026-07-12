import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageOrders } from "@/lib/permissions";
import { listOrders } from "./service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

const STATUS_VARIANT: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
  PENDING: "secondary",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManage = canManageOrders(session);
  const orders = await listOrders(session);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"}
            {!canManage && " assigned to you"}
          </p>
        </div>
        {canManage && (
          <Link href="/orders/new" className={cn(buttonVariants({ variant: "default" }))}>
            + New order
          </Link>
        )}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {canManage ? "No orders yet." : "No orders assigned to you yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/30">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading font-medium leading-tight">{order.customerName}</h3>
                    <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.lineItems.length} item{order.lineItems.length === 1 ? "" : "s"}
                  </p>
                  {order.driver && (
                    <p className="text-xs text-muted-foreground">Driver: {order.driver.name}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
