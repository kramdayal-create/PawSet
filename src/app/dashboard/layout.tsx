import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { PawPrint, Settings, LogOut } from "lucide-react";
import { env } from "@/lib/env";
import { SidebarNav, MobileNav } from "./nav-links";

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
        <div className="px-5 py-6">
          <Link href="/dashboard" className="flex items-baseline gap-1.5">
            <span className="font-logo text-2xl font-bold tracking-tight text-sidebar-accent">PawSet</span>
          </Link>
        </div>
        <SidebarNav />
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{displayName}</p>
            </div>
          </div>
          <form action={logOut}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-white/10 hover:text-white text-xs"
              type="submit"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-baseline gap-1.5">
          <span className="font-logo text-xl font-bold text-primary">PawSet</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/dashboard/pets/new"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-paw-yellowsoft text-foreground"
            aria-label="Add a companion"
          >
            <PawPrint className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        <main className="flex-1 px-4 sm:px-6 py-6 md:py-8 max-w-4xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
