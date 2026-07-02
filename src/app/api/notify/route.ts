import { createServiceClient } from "@/lib/supabase/server";
import { verifyXunhuNotify } from "@/lib/xunhupay";
import {
  notifyStockOutIfNeeded,
  notifyProductSoldOutIfNeeded,
} from "@/lib/alert";

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
    const { data: secret, error } = await supabase.rpc("deliver_order", {
      p_trade_order_id: params.trade_order_id,
    });
    if (error) {
      console.error("[notify] deliver_order failed", error.message);
      // Let 虎皮椒 retry by NOT returning success.
      return new Response("retry", { status: 500 });
    }
    // 返回 null 可能是「已付但缺货」——读订单确认并告警（订单不存在则忽略）。
    if (secret === null) {
      const { data: o } = await supabase
        .from("orders")
        .select("id, status, card_id, trade_order_id")
        .eq("trade_order_id", params.trade_order_id)
        .single();
      if (o && o.status === "paid" && !o.card_id) {
        await notifyStockOutIfNeeded(supabase, o.id, o.trade_order_id);
      }
    } else {
      // 发卡成功 → 若这是该商品最后一张卡，推「售罄补货」提醒（内部去重）。
      const { data: o } = await supabase
        .from("orders")
        .select("product_id")
        .eq("trade_order_id", params.trade_order_id)
        .single();
      if (o?.product_id) {
        await notifyProductSoldOutIfNeeded(supabase, o.product_id);
      }
    }
  }

  return new Response("success");
}
