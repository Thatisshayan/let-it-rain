import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIVE: "Received",
  REMOVE: "Removed",
  ADJUST: "Count adjusted",
};

export default async function DashboardPage() {
  const [totalItems, items, recentMovements] = await Promise.all([
    prisma.item.count(),
    prisma.item.findMany({ select: { id: true, name: true, quantity: true, minStock: true } }),
    prisma.movement.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { item: { select: { name: true, id: true } }, user: { select: { name: true } } },
    }),
  ]);

  const lowStockItems = items.filter((i) => i.quantity < i.minStock);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total units in stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{totalUnits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low-stock items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-destructive">
              {lowStockItems.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low-stock items</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing is running low. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {lowStockItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/items/${item.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">
                          {item.quantity} / min {item.minStock}
                        </span>
                        <Badge variant="destructive">Low</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y">
                {recentMovements.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <Link href={`/items/${m.item.id}`} className="font-medium hover:underline">
                      {m.item.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      — {MOVEMENT_LABEL[m.type] ?? m.type} ({m.delta > 0 ? "+" : ""}
                      {m.delta}) by {m.user.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
