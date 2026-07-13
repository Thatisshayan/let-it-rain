import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { UsersTab } from "./users-tab";
import { AccountTab } from "./account-tab";
import { AuditLogTab } from "./audit-log-tab";
import { OrgSettingsTab } from "./org-settings-tab";
import { getOrgSettings } from "./service";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManageUsers = hasPermission(session, "MANAGE_USERS");
  const canViewAudit = hasPermission(session, "VIEW_AUDIT_LOG");
  const canManageSettings = hasPermission(session, "MANAGE_SETTINGS");
  const { tab: tabParam } = await searchParams;

  const allowed =
    tabParam === "users" && canManageUsers
      ? "users"
      : tabParam === "account"
        ? "account"
        : tabParam === "audit" && canViewAudit
          ? "audit"
          : tabParam === "org" && canManageSettings
            ? "org"
            : canManageUsers
              ? "users"
              : canViewAudit
                ? "audit"
                : "account";

  const users = canManageUsers
    ? await prisma.user.findMany({
        where: { organizationId: session.organizationId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, permissions: true, active: true },
      })
    : [];

  const orgSettings = canManageSettings ? await getOrgSettings(session) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 w-fit">
        {canManageUsers && (
          <Link
            href="/settings?tab=users"
            className={cn(
              buttonVariants({ variant: allowed === "users" ? "default" : "ghost", size: "sm" }),
              allowed !== "users" && "shadow-none"
            )}
          >
            Users
          </Link>
        )}
        {canViewAudit && (
          <Link
            href="/settings?tab=audit"
            className={cn(
              buttonVariants({ variant: allowed === "audit" ? "default" : "ghost", size: "sm" }),
              allowed !== "audit" && "shadow-none"
            )}
          >
            Audit log
          </Link>
        )}
        {canManageSettings && (
          <Link
            href="/settings?tab=org"
            className={cn(
              buttonVariants({ variant: allowed === "org" ? "default" : "ghost", size: "sm" }),
              allowed !== "org" && "shadow-none"
            )}
          >
            Organization
          </Link>
        )}
        <Link
          href="/settings?tab=account"
          className={cn(
            buttonVariants({ variant: allowed === "account" ? "default" : "ghost", size: "sm" }),
            allowed !== "account" && "shadow-none"
          )}
        >
          My account
        </Link>
      </div>

      {allowed === "users" && canManageUsers ? (
        <UsersTab users={users} currentUserId={session.userId} />
      ) : allowed === "audit" && canViewAudit ? (
        <AuditLogTab organizationId={session.organizationId} />
      ) : allowed === "org" && canManageSettings && orgSettings ? (
        <OrgSettingsTab settings={orgSettings} />
      ) : (
        <AccountTab name={session.name} />
      )}
    </div>
  );
}
