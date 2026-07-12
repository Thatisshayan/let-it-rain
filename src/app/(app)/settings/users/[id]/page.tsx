import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "MANAGE_USERS")) {
    return <p className="text-destructive">You don&apos;t have permission to manage users.</p>;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      permissions: true,
      active: true,
      createdAt: true,
      tokenVersion: true,
    },
  });
  if (!user) notFound();

  const auditEntries = await prisma.auditLog.findMany({
    where: { OR: [{ actorId: user.id }, { targetUserId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: { name: true } },
      targetUser: { select: { name: true } },
      order: { select: { id: true, customerName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings?tab=users" className="text-sm text-muted-foreground hover:underline">
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{user.name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">Status:</span>{" "}
              <span className={cn("text-sm font-medium", user.active ? "text-success" : "text-destructive")}>
                {user.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex gap-2">
              <form method="POST" action={`/api/v1/users/${user.id}/revoke-sessions`}>
                <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Sign out everywhere
                </button>
              </form>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-muted-foreground mt-2 mb-1">Permissions</p>
            <div className="flex flex-wrap gap-1">
              {user.permissions.length === 0 ? (
                <span className="text-xs text-muted-foreground">No permissions</span>
              ) : (
                user.permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium"
                  >
                    {p}
                  </span>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <h2 className="text-base font-medium mb-3">Activity</h2>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y">
              {auditEntries.map((e) => (
                <li key={e.id} className="py-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("en-US")}
                    </span>
                    <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {e.action}
                    </span>
                  </div>
                  <p>
                    <span className="font-medium">{e.actor.name}</span> {e.detail}
                    {e.order && (
                      <>
                        {" "}
                        <span className="text-muted-foreground text-xs">
                          (order for{" "}
                          <Link href={`/orders/${e.order.id}`} className="font-medium text-foreground hover:underline">
                            {e.order.customerName}
                          </Link>
                          )
                        </span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}