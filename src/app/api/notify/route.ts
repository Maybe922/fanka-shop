import { createServiceClient } from "@/lib/supabase/server";
import { verifyXunhuNotify } from "@/lib/xunhupay";

export const runtime = "nodejs";

// POST /api/notify — 虎皮椒 async payment callback.
// 虎皮椒 expects the literal body "success" to stop retrying.
export async function POST(req: Request) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<
    string,
    string
  >;

  if (!verifyXunhuNotify(params)) {
    return new Response("sign error", { status: 400 });
  }

  // status "OD" = paid/completed.
  if (params.status === "OD" && params.trade_order_id) {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc("deliver_order", {
      p_trade_order_id: params.trade_order_id,
    });
    if (error) {
      console.error("[notify] deliver_order failed", error.message);
      // Let 虎皮椒 retry by NOT returning success.
      return new Response("retry", { status: 500 });
    }
  }

  return new Response("success");
}
