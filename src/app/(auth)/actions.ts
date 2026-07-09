"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function signUp(formData: FormData) {
  // Demo mode has no accounts — go straight to the dashboard.
  if (env.bypassAuth) redirect("/dashboard");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }
  if (data.session) {
    redirect("/dashboard");
  }
  redirect("/login?message=Check+your+email+to+confirm+your+account.");
}

export async function logIn(formData: FormData) {
  if (env.bypassAuth) redirect("/dashboard");

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next);
}

export async function logOut() {
  if (env.bypassAuth) redirect("/");

  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
