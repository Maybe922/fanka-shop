// Client-safe env values (only NEXT_PUBLIC_* — these are exposed to the browser).
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
};

// Server-only env. Only call these from server components / route handlers,
// never from a "use client" module — they read secrets.
export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少必需的环境变量: ${name}（请在 .env.local 或 Vercel 环境变量中配置）`);
  }
  return value;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
