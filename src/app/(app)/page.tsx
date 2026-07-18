import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MetricCard,
  MetricGrid,
  PageHeader,
  SectionHeading,
} from "@/components/app/page-header";
import { BrandIcon } from "@/components/app/brand";
import { HoverLift, Reveal } from "@/components/app/motion";

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIVE: "Received",
  REMOVE: "Removed",
  ADJUST: "Count adjusted",
};

export default async function DashboardPage() {
  // This page queries Prisma directly (not through the service layer), so it
  // must derive and apply org scope itself. The layout also guards auth, but the
  // org filter has to live on every query here regardless.
  const session = await getSession();
  if (!session) redirect("/login");
  const orgId = session.organizationId;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const [totalItems, items, recentMovements, todayReceipts] = await Promise.all([
    prisma.item.count({ where: { deletedAt: null, organizationId: orgId } }),
    prisma.item.findMany({
      where: { deletedAt: null, organizationId: orgId },
      select: { id: true, name: true, quantity: true, minStock: true },
    }),
    prisma.movement.findMany({
      where: { organizationId: orgId, item: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { item: { select: { name: true, id: true } }, user: { select: { name: true } } },
    }),
    prisma.movement.count({ where: { organizationId: orgId, type: "RECEIVE", createdAt: { gte: todayStart, lt: tomorrowStart } } }),
  ]);

  const lowStockItems = items.filter((i) => i.quantity < i.minStock);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const receivedToday = todayReceipts;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily operating brief"
        title="A calmer, harder-edged command surface for real inventory work."
        description="Start with pressure, then flow, then detail. This surface is tuned for the first two minutes of the day: what is tightening, what changed, and where stock decisions need intervention."
      >
        <MetricGrid>
          <MetricCard label="Tracked items" value={totalItems} hint="Live SKUs in the current organization" />
          <MetricCard label="Units in stock" value={totalUnits} hint="Total physical quantity on hand" />
          <MetricCard
            label="Low-stock items"
            value={String(lowStockItems.length).padStart(2, "0")}
            hint={lowStockItems.length > 0 ? "Needs attention before noon" : "No shortages right now"}
            tone={lowStockItems.length > 0 ? "warning" : "success"}
          />
          <MetricCard label="Receipts today" value={String(receivedToday).padStart(2, "0")} hint="Inbound movement captured" />
        </MetricGrid>
      </PageHeader>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <Reveal delay={0.08}>
        <Card className="command-surface overflow-hidden rounded-[1.8rem] border-border/80 bg-[linear-gradient(145deg,rgba(22,29,47,0.92),rgba(16,21,36,0.98))]">
          <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,1.1fr)_18rem]">
            <div className="p-6 sm:p-8">
              <p className="rule-label">Operating posture</p>
              <h2 className="mt-4 max-w-xl font-heading text-4xl font-semibold tracking-[-0.07em] text-foreground sm:text-5xl sm:leading-[0.95]">
                Inventory trust comes from readable movement, not decorative chrome.
              </h2>
              <p className="serif-accent mt-4 text-2xl leading-none text-primary/78">
                Daily rhythm. Visible stock. Fewer blind spots.
              </p>
              <div className="mt-8 grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-3">
                <div>
                  <p className="rule-label">Low stock</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">{lowStockItems.length}</p>
                </div>
                <div>
                  <p className="rule-label">On hand</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">{totalUnits}</p>
                </div>
                <div>
                  <p className="rule-label">Recent moves</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">{recentMovements.length}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between border-t border-border/70 bg-white/[0.035] p-6 lg:border-t-0 lg:border-l">
              <div className="w-18 max-w-[5rem] overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-2">
                <BrandIcon />
              </div>
              <div className="space-y-4">
                <div className="border-t border-border/70 pt-4">
                  <p className="rule-label">Immediate concern</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {lowStockItems.length > 0
                      ? `${lowStockItems.length} item${lowStockItems.length === 1 ? "" : "s"} are below minimum target and should be reviewed before order flow tightens.`
                      : "No inventory line is below threshold right now."}
                  </p>
                </div>
                <div className="border-t border-border/70 pt-4">
                  <p className="rule-label">Read principle</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Escalation first, raw numbers second, decorative chrome last.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </Reveal>

        <Reveal delay={0.14}>
        <Card className="command-surface rounded-[1.8rem] bg-[linear-gradient(180deg,rgba(15,20,34,0.98),rgba(11,16,28,0.98))] text-white">
          <CardHeader>
            <SectionHeading
              title="Attention queue"
              description="What needs replenishment before it becomes a sales constraint."
            />
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-white/70">Nothing is running low.</p>
            ) : (
              <ul className="space-y-3">
                {lowStockItems.map((item) => (
                  <li key={item.id}>
                    <HoverLift>
                    <Link
                      href={`/items/${item.id}`}
                      className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.045] px-4 py-4 text-sm transition-all hover:bg-white/[0.08]"
                    >
                      <div>
                        <span className="font-medium text-white">{item.name}</span>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                          Restock threshold
                        </p>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-white/72">
                          {item.quantity} / min {item.minStock}
                        </span>
                        <Badge variant="warning">Low</Badge>
                      </span>
                    </Link>
                    </HoverLift>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </Reveal>
      </section>

      <Reveal delay={0.2}>
      <Card className="command-surface rounded-[1.8rem]">
          <CardHeader>
            <SectionHeading
              title="Movement stream"
              description="Latest inventory changes across the organization, arranged as an operating log instead of a raw dump."
            />
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border/75">
                {recentMovements.map((m) => (
                  <li
                    key={m.id}
                    className="grid gap-3 py-4 text-sm md:grid-cols-[9rem_minmax(0,1fr)_auto]"
                  >
                    <div className="rule-label text-primary/80">{MOVEMENT_LABEL[m.type] ?? m.type}</div>
                    <div>
                      <Link href={`/items/${m.item.id}`} className="font-medium hover:underline">
                        {m.item.name}
                      </Link>
                      <p className="mt-1 text-muted-foreground">
                        Delta {m.delta > 0 ? "+" : ""}
                        {m.delta} recorded by {m.user.name}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 md:justify-end">
                      <Badge variant="outline">{m.type}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
