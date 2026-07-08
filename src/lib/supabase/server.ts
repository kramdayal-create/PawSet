import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Supabase client for server components and route handlers.
 * When BYPASS_AUTH=true: returns a service-role client that bypasses RLS,
 * so all queries work without a real user session.
 * Otherwise: bound to the signed-in user's session cookie (subject to RLS).
 */
export function createClient() {
  if (env.bypassAuth) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    return createSupabaseClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; middleware refreshes the session.
        }
      },
    },
  });
}
