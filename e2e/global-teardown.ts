import { createClient } from "@supabase/supabase-js";

/**
 * Removes everything this E2E run created, matched by RUN_TAG. Deleting the
 * tagged pets cascades to their routines, behaviour, medical and share links.
 * Runs with the service-role key so it can clean the demo account.
 */
export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tag = process.env.RUN_TAG;

  if (!url || !key || !tag) {
    console.warn("[e2e teardown] skipped — missing Supabase env or RUN_TAG");
    return;
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pets = await admin.from("pets").delete().ilike("name", `%${tag}%`).select("id");
  const contacts = await admin.from("contacts").delete().ilike("name", `%${tag}%`).select("id");

  console.log(
    `[e2e teardown] removed ${pets.data?.length ?? 0} pet(s), ${contacts.data?.length ?? 0} contact(s) for ${tag}`,
  );
  if (pets.error) console.warn("[e2e teardown] pets:", pets.error.message);
  if (contacts.error) console.warn("[e2e teardown] contacts:", contacts.error.message);
}
