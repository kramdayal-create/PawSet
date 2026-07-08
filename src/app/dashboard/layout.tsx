import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import {
  LayoutDashboard,
  PawPrint,
  Users,
  AlertTriangle,
  Settings,
  LogOut,
} from "lucide-react";
import { env } from "@/lib/env";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, chip: "bg-paw-pinksoft" },
  { href: "/dashboard/pets", label: "My Pets", icon: PawPrint, chip: "bg-paw-yellowsoft" },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users, chip: "bg-paw-skysoft" },
  { href: "/dashboard/emergency-plan", label: "Emergency Plan", icon: AlertTriangle, chip: "bg-paw-limesoft" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, chip: "bg-muted" },
];

async function getUser() {
  if (env.bypassAuth) {
    return { name: "Demo User", email: "demo@pawset.app" };
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  return {
    name: profile?.full_name || user.user_metadata?.full_name || null,
    email: profile?.email || user.email || null,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const displayName = user?.name || user?.email || "My account";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-bold text-foreground text-xl">PawSet</span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${link.chip} text-foreground`}
              >
                <link.icon className="h-4 w-4" />
              </span>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paw-yellow text-xs font-bold text-foreground">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
            </div>
          </div>
          <form action={logOut}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
              type="submit"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">🐾</span>
          <span className="font-bold text-base text-foreground">PawSet</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/dashboard/pets"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-paw-yellowsoft text-foreground"
          >
            <PawPrint className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-10 rounded-t-3xl shadow-card-hover">
        {navLinks.slice(0, 4).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-1 flex-col items-center py-2.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors gap-1"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${link.chip} text-foreground`}
            >
              <link.icon className="h-4 w-4" />
            </span>
            <span>{link.label === "Emergency Plan" ? "Emergency" : link.label}</span>
          </Link>
        ))}
      </nav>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        <main className="flex-1 px-4 sm:px-6 py-6 md:py-8 max-w-4xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
