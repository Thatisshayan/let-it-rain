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
import {
  MetricCard,
  MetricGrid,
  PageHeader,
  SectionHeading,
} from "@/components/app/page-header";

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
  const pendingCount = orders.filter((order) => order.status === "PENDING").length;
  const enRouteCount = orders.filter((order) => order.status === "OUT_FOR_DELIVERY").length;
  const deliveredCount = orders.filter((order) => order.status === "DELIVERED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dispatch board"
        title={
          canManage
            ? "Dispatch should read as movement, assignment, and completion pressure."
            : "See the deliveries currently assigned to you."
        }
        description={`${orders.length} order${orders.length === 1 ? "" : "s"}${!canManage ? " assigned to your workflow" : " visible in the dispatch queue"}.`}
        actions={
          canManage ? (
            <Link href="/orders/new" className={cn(buttonVariants({ variant: "default" }))}>
              + New order
            </Link>
          ) : null
        }
      >
        <MetricGrid>
          <MetricCard label="Visible orders" value={orders.length} hint="Current dispatch board scope" />
          <MetricCard label="Pending" value={pendingCount} hint="Awaiting assignment or action" />
          <MetricCard
            label="En route"
            value={enRouteCount}
            hint="Actively moving through delivery"
            tone={enRouteCount > 0 ? "warning" : "default"}
          />
          <MetricCard
            label="Delivered"
            value={deliveredCount}
            hint="Completed order flow"
            tone={deliveredCount > 0 ? "success" : "default"}
          />
        </MetricGrid>
      </PageHeader>

      {orders.length === 0 ? (
        <Card className="editorial-surface rounded-[1.8rem]">
          <CardContent className="py-10 text-center text-muted-foreground">
            {canManage ? "No orders yet." : "No orders assigned to you yet."}
          </CardContent>
        </Card>
      ) : (
        <Card className="editorial-surface rounded-[1.8rem] overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-border/80 px-5 py-5">
              <SectionHeading
                title="Dispatch ledger"
                description="Customer, status, assignment, and line-item count in one readable flow."
              />
            </div>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_11rem_12rem_8rem] gap-4 border-b border-border/80 px-5 py-4 md:grid">
              <span className="rule-label">Order</span>
              <span className="rule-label">Status</span>
              <span className="rule-label">Driver</span>
              <span className="rule-label text-right">Line items</span>
            </div>
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="grid gap-4 border-b border-border/75 px-5 py-5 transition-colors last:border-b-0 hover:bg-foreground/[0.025] md:grid-cols-[minmax(0,1.5fr)_11rem_12rem_8rem] md:items-center"
            >
              <div className="space-y-1">
                <p className="rule-label md:hidden">Order</p>
                <h3 className="font-heading text-lg font-medium leading-tight tracking-[-0.03em]">
                  {order.customerName}
                </h3>
              </div>
              <div>
                <p className="rule-label md:hidden">Status</p>
                <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
              </div>
              <div>
                <p className="rule-label md:hidden">Driver</p>
                <p className="font-medium text-foreground">{order.driver?.name ?? "Unassigned"}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="rule-label md:hidden">Line items</p>
                <p className="text-lg font-semibold tabular-nums">
                  {order.lineItems.length}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    item{order.lineItems.length === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
            </Link>
          ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
