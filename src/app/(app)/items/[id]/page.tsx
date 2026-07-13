import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AdjustStockForm } from "./adjust-form";
import { DeleteItemButton } from "./delete-button";
import { MovementHistory } from "./movement-history";

const MOVEMENT_PAGE_SIZE = 20;

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const item = await prisma.item.findUnique({
    where: { id, deletedAt: null, organizationId: session.organizationId },
    include: {
      movements: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { user: { select: { name: true } } },
        take: MOVEMENT_PAGE_SIZE,
      },
    },
  });

  if (!item) notFound();

  const lowStock = item.quantity < item.minStock;
  const customFields = (item.customFields as Record<string, string> | null) ?? null;
  const canEdit = hasPermission(session, "EDIT_ITEMS");
  const canDelete = hasPermission(session, "DELETE_ITEMS");
  const canAdjust = hasPermission(session, "ADJUST_STOCK");
  const canViewCosts = hasPermission(session, "VIEW_COSTS");

  const lastMovement = item.movements[item.movements.length - 1];
  const initialCursor =
    item.movements.length === MOVEMENT_PAGE_SIZE && lastMovement
      ? { createdAt: lastMovement.createdAt.toISOString(), id: lastMovement.id }
      : null;

  return (
    <div className="space-y-6">
      {error === "forbidden" && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          You don&apos;t have permission to do that.
        </p>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/items" className="text-sm text-muted-foreground hover:underline">
            ← Inventory
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{item.name}</h1>
            {lowStock && <Badge variant="warning">Low stock</Badge>}
          </div>
          {item.category && <p className="text-sm text-muted-foreground">{item.category}</p>}
        </div>
        <div className="flex gap-2">
          <a
            href={`/items/${item.id}/movements/export.csv`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Export CSV
          </a>
          {canEdit && (
            <Link
              href={`/items/${item.id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Edit
            </Link>
          )}
          {canDelete && <DeleteItemButton itemId={item.id} itemName={item.name} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="bg-gradient-to-br from-primary to-rain bg-clip-text text-3xl font-semibold tabular-nums text-transparent">
                  {item.quantity}
                </span>
                <span className="text-sm text-muted-foreground">in stock</span>
                {item.minStock > 0 && (
                  <span className="ml-auto text-sm text-muted-foreground">
                    Min stock: {item.minStock}
                  </span>
                )}
              </div>
              {canViewCosts && (
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <p className="text-muted-foreground">Unit cost</p>
                    <p className="tabular-nums font-medium">${Number(item.unitCost).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sale price</p>
                    <p className="tabular-nums font-medium">${Number(item.unitPrice).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stock value</p>
                    <p className="tabular-nums font-medium">
                      ${(item.quantity * Number(item.unitCost)).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
              {item.description && <p className="text-sm">{item.description}</p>}
              {customFields && Object.keys(customFields).length > 0 && (
                <>
                  <Separator />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {Object.entries(customFields).map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movement history</CardTitle>
            </CardHeader>
            <CardContent>
              <MovementHistory
                itemId={item.id}
                initialMovements={item.movements.map((m) => ({
                  id: m.id,
                  type: m.type,
                  delta: m.delta,
                  quantityAfter: m.quantityAfter,
                  reason: m.reason,
                  isSale: m.isSale,
                  cashAmount: m.cashAmount ? Number(m.cashAmount) : null,
                  interacAmount: m.interacAmount ? Number(m.interacAmount) : null,
                  unitCostAtTime: m.unitCostAtTime ? Number(m.unitCostAtTime) : null,
                  unitPriceAtTime: m.unitPriceAtTime ? Number(m.unitPriceAtTime) : null,
                  createdAt: m.createdAt.toISOString(),
                  user: m.user,
                }))}
                initialCursor={initialCursor}
              />
            </CardContent>
          </Card>
        </div>

        {canAdjust ? (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Log a movement</CardTitle>
            </CardHeader>
            <CardContent>
              <AdjustStockForm itemId={item.id} currentQuantity={item.quantity} />
            </CardContent>
          </Card>
        ) : (
          <Card className="h-fit">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              You don&apos;t have permission to log stock movements.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
