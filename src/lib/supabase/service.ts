import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"]
      .filter(Boolean)
      .join(", ");
    // Names only, never values -- helps spot a typo'd env var name (extra
    // space, wrong casing, added to the wrong Vercel project, etc.)
    // without ever logging a secret.
    const relatedKeys = Object.keys(process.env).filter((k) => k.includes("SUPABASE"));
    console.error(
      `createServiceClient: ${missing} missing. VERCEL_ENV=${process.env.VERCEL_ENV}, SUPABASE-related env var names present: [${relatedKeys.join(", ")}]`
    );
    throw new Error(
      `Server misconfiguration: ${missing} not set in this environment. Check the Vercel project's Environment Variables and confirm it's enabled for the environment being deployed (Production/Preview/Development), then redeploy.`
    );
  }

  return createClient(url, key);
}
