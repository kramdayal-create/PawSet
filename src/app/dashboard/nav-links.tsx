"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PawPrint,
  Users,
  ClipboardList,
  Settings,
} from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard, chip: "bg-paw-pinksoft" },
  { href: "/dashboard/pets", label: "My Pets", short: "Pets", icon: PawPrint, chip: "bg-paw-yellowsoft" },
  { href: "/dashboard/contacts", label: "Contacts", short: "Contacts", icon: Users, chip: "bg-paw-skysoft" },
  { href: "/dashboard/emergency-plan", label: "Care Plan", short: "Plan", icon: ClipboardList, chip: "bg-paw-limesoft" },
  { href: "/dashboard/settings", label: "Settings", short: "Settings", icon: Settings, chip: "bg-muted" },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navLinks.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-card"
                : "text-sidebar-foreground/90 hover:bg-white/10 hover:text-sidebar-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors",
                active ? "bg-card" : "bg-white/15 text-sidebar-foreground",
              )}
            >
              <link.icon className="h-4 w-4" />
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-10 rounded-t-3xl shadow-card-hover">
      {navLinks.slice(0, 4).map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center py-2.5 text-[10px] font-medium transition-colors gap-1",
              active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-transform",
                link.chip,
                active && "scale-110 shadow-card",
              )}
            >
              <link.icon className="h-4 w-4" />
            </span>
            <span>{link.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
