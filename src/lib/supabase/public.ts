import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// Anon client for reading the public_products view (RLS-protected,
// only safe columns are exposed). Used for landing-page reads.
export function createPublicClient() {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
