import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env";

// Service-role client. Bypasses RLS — server-only. NEVER import into a
// "use client" module or expose the service key to the browser.
export function createServiceClient() {
  return createClient(
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
