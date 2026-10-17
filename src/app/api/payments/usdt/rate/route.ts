import { getBuyer } from "@/lib/supabase/auth-server";
import { getLiveRate } from "@/lib/bep20/core";

export const runtime = "nodejs";
// Share only the public indicative rate, never buyer or order data. Order creation
// still obtains its own fresh quote and reserves its exact payment amount.
let cached: Awaited<ReturnType<typeof getLiveRate>> | undefined;
let pending: ReturnType<typeof getLiveRate> | undefined;
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!await getBuyer()) return Response.json({ error: "请先登录" }, { status: 401, headers });
  try {
    if (!cached || Date.now() - Date.parse(cached.fetchedAt) > 30000) {
      pending ??= getLiveRate();
      try { cached = await pending; } finally { pending = undefined; }
    }
    return Response.json(cached, { headers });
  } catch {
    return Response.json({ error: "实时汇率暂不可用" }, { status: 503, headers });
  }
}
