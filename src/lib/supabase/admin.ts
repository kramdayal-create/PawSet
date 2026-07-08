import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS — never import into client code.
 * Used for: client-portal access after token validation, cron runners,
 * webhook handlers, and storage signed-URL generation.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, serverEnv.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
