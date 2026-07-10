import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/logout/actions";
import { prisma } from "@/lib/prisma";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    select: { quantity: true, minStock: true },
  });
  const lowStockCount = items.filter((i) => i.quantity < i.minStock).length;

  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span>🌧️</span>
            <span>Let It Rain</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Dashboard
            </Link>
            <Link href="/items" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Inventory
            </Link>
            {lowStockCount > 0 && (
              <Link href="/items?low=1" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                Low stock <Badge variant="destructive" className="ml-1">{lowStockCount}</Badge>
              </Link>
            )}
            <Link
              href="/items/new"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Add item
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
