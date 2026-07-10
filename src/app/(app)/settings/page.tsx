import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { UsersTab } from "./users-tab";
import { AccountTab } from "./account-tab";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManageUsers = hasPermission(session, "MANAGE_USERS");
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "users" && canManageUsers ? "users" : tabParam === "account" ? "account" : canManageUsers ? "users" : "account";

  const users = canManageUsers
    ? await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, permissions: true, active: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {canManageUsers && (
          <Link
            href="/settings?tab=users"
            className={cn(
              buttonVariants({ variant: tab === "users" ? "default" : "ghost", size: "sm" }),
              tab !== "users" && "shadow-none"
            )}
          >
            Users
          </Link>
        )}
        <Link
          href="/settings?tab=account"
          className={cn(
            buttonVariants({ variant: tab === "account" ? "default" : "ghost", size: "sm" }),
            tab !== "account" && "shadow-none"
          )}
        >
          My account
        </Link>
      </div>

      {tab === "users" && canManageUsers ? (
        <UsersTab users={users} currentUserId={session.userId} />
      ) : (
        <AccountTab name={session.name} />
      )}
    </div>
  );
}
