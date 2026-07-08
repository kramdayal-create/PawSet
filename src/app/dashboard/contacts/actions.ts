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

export async function createContact(formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const { error } = await supabase.from("contacts").insert({
    user_id: userId,
    name: String(formData.get("name") ?? "").trim(),
    contact_type: String(formData.get("contact_type") ?? "").trim() || null,
    relationship: String(formData.get("relationship") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    can_contact_in_emergency: formData.get("can_contact_in_emergency") === "on",
    has_home_access: formData.get("has_home_access") === "on",
    visible_in_shared_guide: formData.get("visible_in_shared_guide") === "on",
  });

  if (error) {
    return redirect(`/dashboard/contacts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts?saved=1");
}

export async function updateContact(contactId: string, formData: FormData) {
  const userId = await getUserId();
  const supabase = db();

  const { error } = await supabase
    .from("contacts")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      contact_type: String(formData.get("contact_type") ?? "").trim() || null,
      relationship: String(formData.get("relationship") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      can_contact_in_emergency: formData.get("can_contact_in_emergency") === "on",
      has_home_access: formData.get("has_home_access") === "on",
      visible_in_shared_guide: formData.get("visible_in_shared_guide") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
    .eq("user_id", userId);

  if (error) {
    return redirect(`/dashboard/contacts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts?saved=1");
}

export async function deleteContact(contactId: string) {
  const userId = await getUserId();
  const supabase = db();

  await supabase.from("contacts").delete().eq("id", contactId).eq("user_id", userId);

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts");
}
