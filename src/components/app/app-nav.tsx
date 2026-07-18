"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Package2,
  Settings,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/items", label: "Inventory", icon: Package2 },
  { href: "/orders", label: "Orders", icon: Truck },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({
  lowStockCount,
  className,
}: {
  lowStockCount: number;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-2 lg:flex-col", className)} aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex min-w-max items-center gap-3 rounded-[1.1rem] border px-3 py-2.5 text-sm transition-all duration-200",
              active
                ? "border-white/12 bg-white/8 text-white shadow-[inset_3px_0_0_0_rgba(170,190,255,0.8)]"
                : "border-transparent bg-transparent text-white/62 hover:border-white/8 hover:bg-white/4 hover:text-white"
            )}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-xl border transition-colors",
                active
                  ? "border-white/14 bg-white/10 text-white"
                  : "border-white/8 bg-white/4 text-white/60 group-hover:text-white"
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="font-medium">{item.label}</span>
            {item.href === "/items" && lowStockCount > 0 ? (
              <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                {lowStockCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
