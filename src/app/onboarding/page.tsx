import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export default async function OnboardingPage() {
  if (env.bypassAuth) redirect("/dashboard");
  redirect("/dashboard");
}
