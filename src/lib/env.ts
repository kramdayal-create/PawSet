/**
 * Centralized environment access. Public vars are inlined by Next at build
 * time; server-only vars are read lazily so the client bundle never sees them.
 * Integrations degrade gracefully when their vars are absent (documented in
 * ARCHITECTURE.md) so the core product runs without every third party wired.
 */

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Auth is bypassed until BYPASS_AUTH=false is explicitly set. */
  bypassAuth: process.env.BYPASS_AUTH !== "false",
};

/** Server-only secrets. Calling from the client throws. */
export const serverEnv = {
  get supabaseServiceKey() {
    // In demo / bypass mode, fall back to the anon key so the app starts with
    // zero config. The anon key is already public; the service-role key only
    // matters for RLS bypass, which isn't needed when bypassAuth=true because
    // createClient() already returns a service-role client directly.
    // Real auth (BYPASS_AUTH=false) still requires the proper key.
    const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (v) return v;
    if (env.bypassAuth) return env.supabaseAnonKey || "";
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get appSecret() {
    // In demo / bypass mode, fall back to a fixed development secret so the app
    // runs with zero configuration. Portal-token HMACs only need to be stable
    // within a deployment; this fallback is never used once real auth is on
    // (BYPASS_AUTH=false), where a configured APP_SECRET is required.
    const v = process.env.APP_SECRET;
    if (v) return v;
    if (env.bypassAuth) return "docchase-demo-mode-stable-app-secret-not-for-production";
    return required("APP_SECRET");
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get storageBucket() {
    return process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
  },
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required server env var ${name}. See .env.example.`,
    );
  }
  return v;
}

/** True when an integration's vars are present, for graceful degradation. */
export const features = {
  get stripe() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
  get resend() {
    return Boolean(process.env.RESEND_API_KEY);
  },
  get twilio() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN,
    );
  },
  get quickbooks() {
    return Boolean(process.env.QBO_CLIENT_ID);
  },
  get xero() {
    return Boolean(process.env.XERO_CLIENT_ID);
  },
  get clamav() {
    return Boolean(process.env.CLAMAV_SCAN_URL);
  },
};
