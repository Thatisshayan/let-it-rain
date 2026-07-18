import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { UsersTab } from "./users-tab";
import { AccountTab } from "./account-tab";
import { AuditLogTab } from "./audit-log-tab";
import { OrgSettingsTab } from "./org-settings-tab";
import { getOrgSettings } from "./service";
import {
  MetricCard,
  MetricGrid,
  PageHeader,
  SectionHeading,
} from "@/components/app/page-header";

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
  const activeUserCount = users.filter((user) => user.active).length;
  const inactiveUserCount = users.length - activeUserCount;
  const tabs = [
    canManageUsers
      ? {
          id: "users",
          href: "/settings?tab=users",
          label: "Users",
          detail: `${users.length} people`,
        }
      : null,
    canViewAudit
      ? {
          id: "audit",
          href: "/settings?tab=audit",
          label: "Audit log",
          detail: "Recorded events",
        }
      : null,
    canManageSettings
      ? {
          id: "org",
          href: "/settings?tab=org",
          label: "Organization",
          detail: "Defaults and identity",
        }
      : null,
    {
      id: "account",
      href: "/settings?tab=account",
      label: "My account",
      detail: "Profile and access",
    },
  ].filter(Boolean) as Array<{ id: string; href: string; label: string; detail: string }>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace configuration"
        title="Administration should feel controlled, segmented, and accountable."
        description="Administrative settings are segmented by responsibility so user management, audit review, org defaults, and account actions stay predictable."
      >
        <MetricGrid>
          <MetricCard
            label="Active users"
            value={canManageUsers ? activeUserCount : "—"}
            hint={canManageUsers ? "Currently enabled accounts" : "User administration unavailable"}
          />
          <MetricCard
            label="Inactive users"
            value={canManageUsers ? inactiveUserCount : "—"}
            hint={canManageUsers ? "Disabled without deleting history" : "No visibility"}
          />
          <MetricCard
            label="Audit visibility"
            value={canViewAudit ? "Enabled" : "Restricted"}
            hint="Event history access"
            tone={canViewAudit ? "success" : "default"}
          />
          <MetricCard
            label="Org defaults"
            value={canManageSettings ? "Editable" : "Locked"}
            hint="Business identity and low-stock baseline"
            tone={canManageSettings ? "success" : "default"}
          />
        </MetricGrid>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="editorial-surface rounded-[1.8rem] p-4">
            <SectionHeading
              title="Settings sections"
              description="Choose one responsibility area."
            />
            <nav className="mt-4 space-y-2" aria-label="Settings sections">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={allowed === tab.id ? "page" : undefined}
                  className={cn(
                    "block rounded-[1.15rem] border px-4 py-3 transition-colors",
                    allowed === tab.id
                      ? "border-primary/20 bg-primary/[0.08] text-foreground"
                      : "border-transparent hover:border-border/80 hover:bg-foreground/[0.025]"
                  )}
                >
                  <p className="font-medium text-foreground">{tab.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{tab.detail}</p>
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
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
      </div>
    </div>
  );
}
