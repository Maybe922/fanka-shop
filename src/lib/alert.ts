import type { createServiceClient } from "@/lib/supabase/server";

// 运营告警：把要命的事件（如「已付但缺货」）推到你真会看的地方。
// 配了 ALERT_WEBHOOK_URL（如 Server酱 的 .send 地址）就推送；没配则只落服务端日志。
// 仅服务端调用。

type ServiceClient = ReturnType<typeof createServiceClient>;

/** 推一条告警。失败不抛错——告警本身不能拖垮发卡链路。 */
export async function sendAlert(title: string, text: string): Promise<void> {
  console.error(`[ALERT] ${title} — ${text}`);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    // Server酱 / PushPlus 兼容：表单字段 title + desp/content 都带上。
    const body = new URLSearchParams({ title, desp: text, content: text });
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error("[ALERT] webhook 推送失败", err);
  }
}

function stockOutText(orderRef: string): string {
  return `订单 ${orderRef} 已付款但无可发卡密，请尽快补货或为买家退款。`;
}

/**
 * 「已付但缺货」告警 + 原子去重。
 *
 * 调用前提：调用方已确认该订单 status=paid 且 card_id 为空。
 * 去重靠把 stock_alerted_at 从 null 抢占为 now()——只有抢到的那一次才推送，
 * 因此订单页每 2.5s 的轮询不会重复轰炸。
 */
export async function notifyStockOutIfNeeded(
  supabase: ServiceClient,
  orderId: string,
  tradeOrderId: string | null,
): Promise<void> {
  const ref = tradeOrderId ?? orderId;
  const { data, error } = await supabase
    .from("orders")
    .update({ stock_alerted_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "paid")
    .is("card_id", null)
    .is("stock_alerted_at", null)
    .select("id");

  if (error) {
    // 列还没建（schema 未迁移）→ 退化为尽力推送一次，宁可重复也别漏。
    await sendAlert("⚠️ 已付但缺货", stockOutText(ref));
    return;
  }
  if (data && data.length > 0) {
    await sendAlert("⚠️ 已付但缺货", stockOutText(ref));
  }
}
