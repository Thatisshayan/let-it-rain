import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AdjustStockForm } from "./adjust-form";
import { DeleteItemButton } from "./delete-button";

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIVE: "Received",
  REMOVE: "Removed",
  ADJUST: "Count adjusted",
};

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
        take: 100,
      },
    },
  });

  if (!item) notFound();

  const lowStock = item.quantity < item.minStock;
  const customFields = (item.customFields as Record<string, string> | null) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/items" className="text-sm text-muted-foreground hover:underline">
            ← Inventory
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{item.name}</h1>
            {lowStock && <Badge variant="destructive">Low stock</Badge>}
          </div>
          {item.category && <p className="text-sm text-muted-foreground">{item.category}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/items/${item.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Edit
          </Link>
          <DeleteItemButton itemId={item.id} itemName={item.name} />
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
                <span className="text-3xl font-semibold tabular-nums">{item.quantity}</span>
                <span className="text-sm text-muted-foreground">in stock</span>
                {item.minStock > 0 && (
                  <span className="ml-auto text-sm text-muted-foreground">
                    Min stock: {item.minStock}
                  </span>
                )}
              </div>
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
              {item.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
              ) : (
                <ul className="divide-y">
                  {item.movements.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {MOVEMENT_LABEL[m.type] ?? m.type}{" "}
                          <span className="tabular-nums text-muted-foreground">
                            ({m.delta > 0 ? "+" : ""}
                            {m.delta})
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.user.name} · {new Date(m.createdAt).toLocaleString()}
                        </p>
                        {m.reason && <p className="mt-1 text-xs">{m.reason}</p>}
                      </div>
                      <span className="tabular-nums text-muted-foreground">→ {m.quantityAfter}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Log a movement</CardTitle>
          </CardHeader>
          <CardContent>
            <AdjustStockForm itemId={item.id} currentQuantity={item.quantity} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
