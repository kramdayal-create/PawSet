"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeShareToken } from "@/lib/pawset/token";
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

export async function createShareLink(petId: string, formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const { data, error } = await supabase
    .from("share_links")
    .insert({
      user_id: userId,
      pet_id: petId,
      token: makeShareToken(),
      title: String(formData.get("title") ?? "").trim() || null,
      include_basic_details: formData.get("include_basic_details") === "on",
      include_routine: formData.get("include_routine") === "on",
      include_behaviour: formData.get("include_behaviour") === "on",
      include_medical: formData.get("include_medical") === "on",
      include_contacts: formData.get("include_contacts") === "on",
      include_access_notes: formData.get("include_access_notes") === "on",
      is_active: true,
    })
    .select("token")
    .single();

  if (error) {
    return redirect(`/dashboard/pets/${petId}?tab=share&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/pets/${petId}`);
  redirect(`/dashboard/pets/${petId}?tab=share&created=${data.token}`);
}

export async function revokeShareLink(linkId: string, petId: string) {
  const userId = await getUserId();
  const supabase = db();

  await supabase
    .from("share_links")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("user_id", userId);

  revalidatePath(`/dashboard/pets/${petId}`);
  redirect(`/dashboard/pets/${petId}?tab=share`);
}

export async function deleteShareLink(linkId: string, petId: string) {
  const userId = await getUserId();
  const supabase = db();

  await supabase
    .from("share_links")
    .delete()
    .eq("id", linkId)
    .eq("user_id", userId);

  revalidatePath(`/dashboard/pets/${petId}`);
  redirect(`/dashboard/pets/${petId}?tab=share`);
}
