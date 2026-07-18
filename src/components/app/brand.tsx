import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
      <Link href="/" className={cn("flex items-center gap-3", className)}>
        <div className="w-11 shrink-0 overflow-hidden rounded-2xl shadow-[0_12px_32px_-20px_rgba(7,35,94,0.55)]">
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
    );
  }

  return (
    <Link href="/" className={cn("block", className)}>
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/85 bg-white px-4 py-3 shadow-[0_20px_45px_-28px_rgba(7,35,94,0.32)]">
        <BrandLogo priority className="block" />
      </div>
    </Link>
  );
}
