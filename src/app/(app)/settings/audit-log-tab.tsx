import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

type AuditEntry = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date;
  actor: { id: string; name: string };
  targetUser: { id: string; name: string } | null;
  order: { id: string; customerName: string } | null;
};

export async function AuditLogTab({
  organizationId,
  page,
  pageSize,
}: {
  // Required: the caller's org, derived from the session in settings/page.tsx.
  organizationId: string;
  page?: number;
  pageSize?: number;
}) {
  const safePage = Math.max(1, page ?? 1);
  const safePageSize = Math.min(200, Math.max(1, pageSize ?? 50));
  const entries = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    include: {
      actor: { select: { id: true, name: true } },
      targetUser: { select: { id: true, name: true } },
      order: { select: { id: true, customerName: true } },
    },
  });

  return (
    <Card>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No audit log entries yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <AuditEntryRow entry={e as AuditEntry} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const time = new Date(entry.createdAt).toLocaleString("en-US");
  const actor = entry.actor.name;
  const target = entry.targetUser?.name;
  const order = entry.order?.customerName;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{time}</span>
        <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium">
          {entry.action}
        </span>
        {target && (
          <span className="text-xs text-muted-foreground">
            target: <span className="font-medium text-foreground">{target}</span>
          </span>
        )}
      </div>
      <p className="text-foreground">
        <span className="font-medium">{actor}</span>{" "}
        {entry.detail}
        {order && (
          <>
            {" "}
            <span className="text-muted-foreground">
              (order for <span className="font-medium text-foreground">{order}</span>)
            </span>
          </>
        )}
      </p>
    </div>
  );
}