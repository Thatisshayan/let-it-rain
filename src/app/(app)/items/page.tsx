import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const items = await prisma.item.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/items/new" className={cn(buttonVariants({ variant: "default" }))}>
          + Add item
        </Link>
      </div>

      <form className="max-w-sm">
        <Input
          name="q"
          placeholder="Search by name or category…"
          defaultValue={q ?? ""}
        />
      </form>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No items yet. Add your first item to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const lowStock = item.quantity < item.minStock;
            return (
              <Link key={item.id} href={`/items/${item.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium leading-tight">{item.name}</h3>
                      {lowStock && <Badge variant="destructive">Low stock</Badge>}
                    </div>
                    {item.category && (
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    )}
                    <p className="text-2xl font-semibold tabular-nums">
                      {item.quantity}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        in stock
                      </span>
                    </p>
                    {item.minStock > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Min stock: {item.minStock}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
