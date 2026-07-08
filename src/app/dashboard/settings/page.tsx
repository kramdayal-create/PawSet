import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";
import { logOut } from "../../(auth)/actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

async function updateProfile(formData: FormData) {
  "use server";
  if (env.bypassAuth) return redirect("/dashboard/settings?saved=1");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();

  await supabase
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=1");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const supabase = db();
  let userId = "00000000-0000-0000-0000-000000000000";
  let userEmail = env.bypassAuth ? "demo@pawset.app" : "";

  if (!env.bypassAuth) {
    const { data: { user } } = await createClient().auth.getUser();
    if (user) {
      userId = user.id;
      userEmail = user.email ?? "";
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {searchParams.saved && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          Settings saved.
        </div>
      )}

      {/* Profile */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
        <h2 className="font-semibold text-foreground">Your profile</h2>
        <form action={updateProfile} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile?.full_name ?? ""}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={userEmail} disabled className="opacity-60" readOnly />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
          <Button type="submit">Save profile</Button>
        </form>
      </div>

      {/* Privacy */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-3">
        <h2 className="font-semibold text-foreground">Privacy & data</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Your pet information is private and only visible to you.</p>
          <p>Shared links show only what you choose to include. You can revoke any shared link at any time.</p>
          <p>We never share your data with third parties or use it to train AI models.</p>
        </div>
      </div>

      {/* Account */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-3">
        <h2 className="font-semibold text-foreground">Account</h2>
        <form action={logOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
