import { cn } from "@/lib/utils";
import { HoverLift, Reveal } from "@/components/app/motion";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "command-surface command-grid relative overflow-hidden rounded-[2rem] p-6 sm:p-8",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/18 to-transparent" />
      <div className="absolute inset-y-8 right-8 hidden w-40 rounded-full bg-[radial-gradient(circle,rgba(70,122,255,0.22),transparent_72%)] blur-2xl lg:block" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow ? (
            <p className="rule-label pl-2 text-primary/80">
              {eyebrow}
            </p>
          ) : null}
          <div className="space-y-2">
            <h1 className="max-w-4xl pl-2 font-heading text-4xl font-semibold tracking-[-0.07em] text-foreground sm:text-5xl lg:text-[4.6rem] lg:leading-[0.9]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl pl-2 text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children ? <div className="relative mt-6">{children}</div> : null}
    </Reveal>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "success";
}) {
  const toneClasses =
    tone === "warning"
      ? "border-warning/18 bg-warning/10"
      : tone === "success"
        ? "border-success/18 bg-success/10"
        : "border-white/10 bg-white/[0.035]";

  return (
    <HoverLift className={cn("rounded-[1.5rem] border p-4 backdrop-blur-sm transition-colors", toneClasses)}>
      <p className="rule-label">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-2 max-w-[18rem] text-sm leading-6 text-muted-foreground">{hint}</p> : null}
    </HoverLift>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold tracking-[-0.03em] text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
