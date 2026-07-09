import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { signUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Demo mode has no accounts — the dashboard is open.
  if (env.bypassAuth) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl">🐾</span>
            <span className="text-xl font-bold text-primary">PawSet</span>
          </Link>
          <h1 className="text-3xl text-canvas">Create your pet plan</h1>
          <p className="text-canvas-muted mt-1 text-sm">
            Peace of mind for you and your pet — ready in minutes
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-card border border-border p-6">
          {searchParams.error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {decodeURIComponent(searchParams.error)}
            </div>
          )}

          <form action={signUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Your name</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Create my pet plan
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Your pet&apos;s information is private and secure. We never share your data.
          </p>
        </div>

        <p className="text-center text-sm text-canvas-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
