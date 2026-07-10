import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; page?: string }>;
}) {
  const { q, low, page: pageParam } = await searchParams;
  const lowOnly = low === "1";
  const page = Math.max(1, Number(pageParam) || 1);

  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [allMatching, total] = await Promise.all([
    // Low-stock filtering compares two columns, which Prisma can't express
    // in `where` directly, so filter in JS after a bounded fetch.
    lowOnly ? prisma.item.findMany({ where, orderBy: { name: "asc" } }) : Promise.resolve(null),
    lowOnly ? Promise.resolve(0) : prisma.item.count({ where }),
  ]);

  const lowStockFiltered = lowOnly ? allMatching!.filter((i) => i.quantity < i.minStock) : null;

  const items = lowOnly
    ? lowStockFiltered!.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : await prisma.item.findMany({
        where,
        orderBy: { name: "asc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      });

  const totalCount = lowOnly ? lowStockFiltered!.length : total;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (lowOnly) params.set("low", "1");
    params.set("page", String(p));
    return `/items?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} item{totalCount === 1 ? "" : "s"}
            {lowOnly && " · low stock only"}
          </p>
        </div>
        <Link href="/items/new" className={cn(buttonVariants({ variant: "default" }))}>
          + Add item
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="max-w-sm flex-1">
          <Input name="q" placeholder="Search by name or category…" defaultValue={q ?? ""} />
          {lowOnly && <input type="hidden" name="low" value="1" />}
        </form>
        <Link
          href={lowOnly ? `/items${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/items?low=1`}
          className={cn(buttonVariants({ variant: lowOnly ? "default" : "outline", size: "sm" }))}
        >
          {lowOnly ? "Showing low stock only ✕" : "Low stock only"}
        </Link>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No items found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const lowStock = item.quantity < item.minStock;
            return (
              <Link key={item.id} href={`/items/${item.id}`}>
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/30">
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-heading font-medium leading-tight">{item.name}</h3>
                      {lowStock && <Badge variant="warning">Low stock</Badge>}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page <= 1 && "pointer-events-none opacity-50"
            )}
          >
            Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= totalPages}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page >= totalPages && "pointer-events-none opacity-50"
            )}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
