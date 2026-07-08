"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

async function getUserId(): Promise<string> {
  if (env.bypassAuth) return "00000000-0000-0000-0000-000000000000";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

function db() {
  return env.bypassAuth ? createAdminClient() : createClient();
}

export async function upsertEmergencyPlan(formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const nullOrVal = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const payload = {
    user_id: userId,
    primary_contact_id: nullOrVal("primary_contact_id"),
    backup_contact_id: nullOrVal("backup_contact_id"),
    preferred_carer_id: nullOrVal("preferred_carer_id"),
    spare_key_contact_id: nullOrVal("spare_key_contact_id"),
    access_notes: nullOrVal("access_notes"),
    pet_carrier_location: nullOrVal("pet_carrier_location"),
    food_location: nullOrVal("food_location"),
    medication_location: nullOrVal("medication_location"),
    vet_authorisation_note: nullOrVal("vet_authorisation_note"),
    emergency_budget_guidance: nullOrVal("emergency_budget_guidance"),
    unreachable_after_hours: nullOrVal("unreachable_after_hours")
      ? parseInt(String(formData.get("unreachable_after_hours")))
      : null,
    general_instructions: nullOrVal("general_instructions"),
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("emergency_plans")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("emergency_plans")
      .update(payload)
      .eq("id", existing.id);
  } else {
    await supabase.from("emergency_plans").insert(payload);
  }

  revalidatePath("/dashboard/emergency-plan");
  redirect("/dashboard/emergency-plan?saved=1");
}
