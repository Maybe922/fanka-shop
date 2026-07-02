import type { createServiceClient } from "@/lib/supabase/server";

// 运营告警：把要命的事件（「已付但缺货」「商品售罄」）推到你真会看的地方。
// 两个通道，配了哪个走哪个（都配则都发）：
//   1) Telegram 机器人：TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//   2) 表单式 webhook（Server酱/PushPlus 等）：ALERT_WEBHOOK_URL
// 仅服务端调用。

type ServiceClient = ReturnType<typeof createServiceClient>;

const PUSH_TIMEOUT_MS = 5000; // 推送通道卡住不能拖垮发卡请求

async function sendTelegram(title: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `${title}\n${text}` }),
      cache: "no-store",
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[ALERT] Telegram 推送失败", res.status, await res.text());
    }
  } catch (err) {
    // 大陆机房出站到 api.telegram.org 会被墙 —— 超时也只记日志，不影响主流程
    console.error("[ALERT] Telegram 推送异常", err);
  }
}

async function sendWebhook(title: string, text: string): Promise<void> {
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
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[ALERT] webhook 推送失败", err);
  }
}

/** 推一条告警到所有已配置的通道。失败不抛错——告警本身不能拖垮发卡链路。 */
export async function sendAlert(title: string, text: string): Promise<void> {
  console.error(`[ALERT] ${title} — ${text}`);
  await Promise.all([sendTelegram(title, text), sendWebhook(title, text)]);
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

/**
 * 「商品售罄」补货提醒 + 原子去重。发卡成功后调用：最后一张卡卖出时提醒进货。
 *
 * 去重靠把 products.soldout_alerted_at 从 null 抢占为 now()——回调与主动查单
 * 竞态、重复回调都只会推送一次；后台「进货」会把该字段清空重新武装。
 * 只在真实售出（发卡）时触发；下单预占不算（可能超时释放回库存）。
 */
export async function notifyProductSoldOutIfNeeded(
  supabase: ServiceClient,
  productId: string,
): Promise<void> {
  const { count: unsold } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "unsold");
  if ((unsold ?? 0) > 0) return;

  const { data, error } = await supabase
    .from("products")
    .update({ soldout_alerted_at: new Date().toISOString() })
    .eq("id", productId)
    .is("soldout_alerted_at", null)
    .select("id, name");

  if (error) {
    // 列还没建（schema 未迁移）→ 尽力推送；售罄后不再有新发卡，重复有限。
    await sendAlert("📦 商品售罄", `商品 ${productId} 库存已售罄，请及时补货。`);
    return;
  }
  if (data && data.length > 0) {
    const { count: sold } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("status", "sold");
    await sendAlert(
      "📦 商品售罄",
      `「${data[0].name}」最后一张卡密已售出（累计售出 ${sold ?? "?"} 张），请及时补货。`,
    );
  }
}
