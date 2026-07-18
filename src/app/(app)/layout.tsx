import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logoutAction } from "@/app/logout/actions";
import { prisma } from "@/lib/prisma";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/app/app-nav";
import { BrandLink } from "@/components/app/brand";

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
    where: { deletedAt: null, organizationId: session.organizationId },
    select: { quantity: true, minStock: true },
  });
  const lowStockCount = items.filter((i) => i.quantity < i.minStock).length;
  const canEdit = hasPermission(session, "EDIT_ITEMS");

  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[100rem] flex-col px-3 py-3 lg:grid lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-5 lg:px-4 lg:py-4">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="flex h-full flex-col rounded-[1.8rem] border border-sidebar-border bg-sidebar p-4 text-sidebar-foreground shadow-[0_28px_70px_-42px_rgba(15,23,42,0.58)]">
            <div className="pb-5">
              <BrandLink />
            </div>

            <div className="overflow-x-auto pb-3 lg:overflow-visible">
              <AppNav lowStockCount={lowStockCount} />
            </div>

            <div className="mt-4 hidden rounded-[1.4rem] border border-white/10 bg-white/4 p-4 lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">
                Quick pulse
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-sidebar-foreground/65">Low-stock items</span>
                  <Badge variant={lowStockCount > 0 ? "warning" : "secondary"}>
                    {lowStockCount}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-sidebar-foreground/65">Edit access</span>
                  <span className="font-medium text-sidebar-foreground">
                    {canEdit ? "Enabled" : "Limited"}
                  </span>
                </div>
                {canEdit ? (
                  <Link
                    href="/items/new"
                    className={cn(buttonVariants({ variant: "secondary" }), "mt-2 w-full")}
                  >
                    Add new item
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-auto hidden lg:block">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-white/10 text-sidebar-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sidebar-foreground">{session.name}</p>
                    <p className="truncate text-sm text-sidebar-foreground/60">{session.email}</p>
                  </div>
                </div>
                <form action={logoutAction} className="mt-4">
                  <Button variant="outline" className="w-full border-white/15 bg-transparent text-sidebar-foreground hover:bg-white/6 hover:text-sidebar-foreground" type="submit">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 mb-4 rounded-[1.4rem] border border-border/80 bg-card/95 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <BrandLink compact />
                <p className="mt-2 truncate pl-14 text-xs text-muted-foreground">{session.name}</p>
              </div>
              <form action={logoutAction}>
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </div>
          </header>

          <main className="min-w-0 flex-1 pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
