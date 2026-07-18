import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  SectionHeading,
} from "@/components/app/page-header";

const PAGE_SIZE = 24;

type ItemRow = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  minStock: number;
};

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; page?: string }>;
}) {
  const { q, low, page: pageParam } = await searchParams;
  const lowOnly = low === "1";
  const page = Math.max(1, Number(pageParam) || 1);
  const session = await getSession();
  if (!session) redirect("/login");
  const canEdit = hasPermission(session, "EDIT_ITEMS");

  const where = {
    deletedAt: null,
    organizationId: session.organizationId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { category: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  let items: ItemRow[];
  let totalCount: number;

  if (lowOnly) {
    // Low-stock filtering compares two columns of the same row, which
    // Prisma's query builder can't express in `where` — done as a
    // parameterized raw query instead, filtered and paginated at the DB
    // level rather than fetching the whole table into JS.
    const searchClause = q
      ? Prisma.sql`AND (name ILIKE ${"%" + q + "%"} OR category ILIKE ${"%" + q + "%"})`
      : Prisma.empty;

    // Org scope is applied inside the raw SQL too — this hand-written query is
    // NOT covered by Prisma's where-based scoping, so the tenant predicate must
    // be added explicitly (parameterized) or it would leak every org's low stock.
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<ItemRow[]>`
        SELECT id, name, category, quantity, "minStock"
        FROM "Item"
        WHERE "deletedAt" IS NULL
          AND "organizationId" = ${session.organizationId}
          AND quantity < "minStock"
          ${searchClause}
        ORDER BY name ASC
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Item"
        WHERE "deletedAt" IS NULL
          AND "organizationId" = ${session.organizationId}
          AND quantity < "minStock"
          ${searchClause}
      `,
    ]);

    items = rows;
    totalCount = Number(countRows[0]?.count ?? 0);
  } else {
    const [rows, count] = await Promise.all([
      prisma.item.findMany({
        where,
        orderBy: { name: "asc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        select: { id: true, name: true, category: true, quantity: true, minStock: true },
      }),
      prisma.item.count({ where }),
    ]);
    items = rows;
    totalCount = count;
  }

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
      <PageHeader
        eyebrow="Inventory operations"
        title="Inventory should read like an operating ledger, not a gallery of cards."
        description={`${totalCount} item${totalCount === 1 ? "" : "s"} currently visible${lowOnly ? ", filtered to low-stock only" : ""}.`}
        actions={
          <>
            <a href="/items/export.csv" className={cn(buttonVariants({ variant: "outline" }))}>
              Export CSV
            </a>
            {canEdit ? (
              <Link href="/items/new" className={cn(buttonVariants({ variant: "default" }))}>
                + Add item
              </Link>
            ) : null}
          </>
        }
      />

      <Card className="editorial-surface rounded-[1.8rem]">
        <CardContent className="space-y-4 py-6">
          <SectionHeading
            title="Find what matters"
            description="Search by item name or category, then narrow the view to inventory that needs attention."
          />
          <div className="flex flex-wrap items-center gap-2">
            <form className="min-w-[16rem] max-w-md flex-1">
              <Input name="q" placeholder="Search by name or category..." defaultValue={q ?? ""} />
              {lowOnly && <input type="hidden" name="low" value="1" />}
            </form>
            <Link
              href={lowOnly ? `/items${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/items?${new URLSearchParams(q ? { q, low: "1" } : { low: "1" }).toString()}`}
              className={cn(
                buttonVariants({ variant: lowOnly ? "default" : "outline", size: "sm" })
              )}
            >
              {lowOnly ? "Showing low stock only x" : "Low stock only"}
            </Link>
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card className="editorial-surface rounded-[1.8rem]">
          <CardContent className="py-10 text-center text-muted-foreground">
            No items found.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[1.8rem] border border-border/80 bg-card shadow-[0_20px_50px_-36px_rgba(31,41,55,0.22)]">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_12rem_11rem_9rem] gap-4 border-b border-border/80 px-5 py-4 md:grid">
            <span className="rule-label">Item</span>
            <span className="rule-label">Status</span>
            <span className="rule-label">On hand</span>
            <span className="rule-label text-right">Minimum</span>
          </div>
          {items.map((item) => {
            const lowStock = item.quantity < item.minStock;
            return (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="grid gap-4 border-b border-border/75 px-5 py-5 transition-colors last:border-b-0 hover:bg-foreground/[0.025] md:grid-cols-[minmax(0,1.6fr)_12rem_11rem_9rem] md:items-center"
              >
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-medium leading-tight tracking-[-0.03em]">{item.name}</h3>
                  {item.category && (
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {item.category}
                    </p>
                  )}
                </div>
                <div>
                  {lowStock ? <Badge variant="warning">Low stock</Badge> : <Badge variant="outline">Healthy</Badge>}
                </div>
                <div className="text-3xl font-semibold tabular-nums tracking-tight">
                  {item.quantity}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">units</span>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-sm text-muted-foreground">Minimum</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{item.minStock}</p>
                </div>
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
