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

/**
 * Save a one-row-per-pet detail table (routine / behaviour / medical).
 *
 * These tables have no unique constraint on pet_id, so `.upsert(..., { onConflict:
 * "pet_id" })` errors at the database and silently loses the write. Do an explicit
 * select-then-update/insert instead, and return any error so the caller can surface it.
 */
async function saveByPetId(
  supabase: ReturnType<typeof db>,
  table: string,
  petId: string,
  payload: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("pet_id", petId)
    .maybeSingle();

  if (existing) {
    return supabase.from(table).update(payload).eq("id", existing.id);
  }
  return supabase.from(table).insert(payload);
}

export async function createPet(formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const { data, error } = await supabase
    .from("pets")
    .insert({
      user_id: userId,
      name: String(formData.get("name") ?? "").trim(),
      species: String(formData.get("species") ?? "dog"),
      breed: String(formData.get("breed") ?? "").trim() || null,
      age_text: String(formData.get("age_text") ?? "").trim() || null,
      birth_date: String(formData.get("birth_date") ?? "").trim() || null,
      sex: String(formData.get("sex") ?? "").trim() || null,
      microchip_number: String(formData.get("microchip_number") ?? "").trim() || null,
      insurance_provider: String(formData.get("insurance_provider") ?? "").trim() || null,
      insurance_policy_number: String(formData.get("insurance_policy_number") ?? "").trim() || null,
      personality_summary: String(formData.get("personality_summary") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return redirect(`/dashboard/pets/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/pets/${data.id}`);
}

export async function updatePet(petId: string, formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const { error } = await supabase
    .from("pets")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      species: String(formData.get("species") ?? "dog"),
      breed: String(formData.get("breed") ?? "").trim() || null,
      age_text: String(formData.get("age_text") ?? "").trim() || null,
      birth_date: String(formData.get("birth_date") ?? "").trim() || null,
      sex: String(formData.get("sex") ?? "").trim() || null,
      microchip_number: String(formData.get("microchip_number") ?? "").trim() || null,
      insurance_provider: String(formData.get("insurance_provider") ?? "").trim() || null,
      insurance_policy_number: String(formData.get("insurance_policy_number") ?? "").trim() || null,
      personality_summary: String(formData.get("personality_summary") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", petId)
    .eq("user_id", userId);

  if (error) {
    return redirect(`/dashboard/pets/${petId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/pets/${petId}`);
  redirect(`/dashboard/pets/${petId}`);
}

export async function deletePet(petId: string) {
  const userId = await getUserId();
  const supabase = db();

  await supabase.from("pets").delete().eq("id", petId).eq("user_id", userId);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function upsertRoutine(petId: string, formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  // Verify ownership
  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!pet) redirect("/dashboard");

  const payload = {
    pet_id: petId,
    feeding_schedule: String(formData.get("feeding_schedule") ?? "").trim() || null,
    food_type: String(formData.get("food_type") ?? "").trim() || null,
    portion_size: String(formData.get("portion_size") ?? "").trim() || null,
    treat_rules: String(formData.get("treat_rules") ?? "").trim() || null,
    unsafe_foods: String(formData.get("unsafe_foods") ?? "").trim() || null,
    water_notes: String(formData.get("water_notes") ?? "").trim() || null,
    exercise_routine: String(formData.get("exercise_routine") ?? "").trim() || null,
    toilet_routine: String(formData.get("toilet_routine") ?? "").trim() || null,
    sleep_routine: String(formData.get("sleep_routine") ?? "").trim() || null,
    favourite_toys: String(formData.get("favourite_toys") ?? "").trim() || null,
    comfort_items: String(formData.get("comfort_items") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await saveByPetId(supabase, "pet_routines", petId, payload);
  if (error) {
    redirect(`/dashboard/pets/${petId}?tab=routine&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/pets/${petId}`);
  redirect(`/dashboard/pets/${petId}?tab=routine&saved=1`);
}

export async function upsertBehaviour(petId: string, formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!pet) redirect("/dashboard");

  const payload = {
    pet_id: petId,
    temperament: String(formData.get("temperament") ?? "").trim() || null,
    anxiety_triggers: String(formData.get("anxiety_triggers") ?? "").trim() || null,
    likes: String(formData.get("likes") ?? "").trim() || null,
    dislikes: String(formData.get("dislikes") ?? "").trim() || null,
    stranger_reaction: String(formData.get("stranger_reaction") ?? "").trim() || null,
    animal_reaction: String(formData.get("animal_reaction") ?? "").trim() || null,
    handling_notes: String(formData.get("handling_notes") ?? "").trim() || null,
    escape_risk: String(formData.get("escape_risk") ?? "").trim() || null,
    noise_sensitivity: String(formData.get("noise_sensitivity") ?? "").trim() || null,
    safety_notes: String(formData.get("safety_notes") ?? "").trim() || null,
    never_do_rules: String(formData.get("never_do_rules") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await saveByPetId(supabase, "pet_behaviour", petId, payload);
  if (error) {
    redirect(`/dashboard/pets/${petId}?tab=behaviour&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/pets/${petId}`);
  redirect(`/dashboard/pets/${petId}?tab=behaviour&saved=1`);
}

export async function upsertMedical(petId: string, formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!pet) redirect("/dashboard");

  const payload = {
    pet_id: petId,
    vet_name: String(formData.get("vet_name") ?? "").trim() || null,
    vet_practice: String(formData.get("vet_practice") ?? "").trim() || null,
    vet_phone: String(formData.get("vet_phone") ?? "").trim() || null,
    vet_email: String(formData.get("vet_email") ?? "").trim() || null,
    vet_address: String(formData.get("vet_address") ?? "").trim() || null,
    known_conditions: String(formData.get("known_conditions") ?? "").trim() || null,
    medications: String(formData.get("medications") ?? "").trim() || null,
    medication_instructions: String(formData.get("medication_instructions") ?? "").trim() || null,
    allergies: String(formData.get("allergies") ?? "").trim() || null,
    vaccination_notes: String(formData.get("vaccination_notes") ?? "").trim() || null,
    special_care_notes: String(formData.get("special_care_notes") ?? "").trim() || null,
    normal_signs: String(formData.get("normal_signs") ?? "").trim() || null,
    unusual_signs: String(formData.get("unusual_signs") ?? "").trim() || null,
    call_owner_if: String(formData.get("call_owner_if") ?? "").trim() || null,
    call_vet_if: String(formData.get("call_vet_if") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await saveByPetId(supabase, "pet_medical", petId, payload);
  if (error) {
    redirect(`/dashboard/pets/${petId}?tab=medical&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/pets/${petId}`);
  redirect(`/dashboard/pets/${petId}?tab=medical&saved=1`);
}
