import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HoverLift, Reveal } from "@/components/app/motion";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-crop.png"
      alt="Let It Rain"
      width={1145}
      height={570}
      priority={priority}
      className={cn("h-auto w-full", className)}
    />
  );
}

export function BrandIcon({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/app-icon-crop.png"
      alt="Let It Rain app icon"
      width={314}
      height={310}
      priority={priority}
      className={cn("h-auto w-full", className)}
    />
  );
}

export function BrandLink({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <HoverLift className={className}>
        <Link href="/" className="flex items-center gap-3">
          <div className="w-11 shrink-0 overflow-hidden rounded-2xl border border-white/12 bg-white/4 shadow-[0_18px_34px_-22px_rgba(0,0,0,0.72)]">
            <BrandIcon priority className="block" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold leading-none text-foreground">
              Let It Rain
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Inventory. Track. Trust.
            </p>
          </div>
        </Link>
      </HoverLift>
    );
  }

  return (
    <Reveal delay={0.06} className={className}>
      <Link href="/" className="block">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-3 shadow-[0_24px_52px_-32px_rgba(0,0,0,0.72)] backdrop-blur-xl">
          <BrandLogo priority className="block" />
        </div>
      </Link>
    </Reveal>
  );
}
