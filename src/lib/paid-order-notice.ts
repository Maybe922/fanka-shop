import { sendFeishuPaidOrder } from "@/lib/feishu";
import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

type ClaimedPaidOrder = {
  order_id: string;
  trade_order_id: string;
  email: string | null;
  amount_cents: number;
  paid_at: string;
  product_name: string;
};

/**
 * 仅为数据库已经确认 paid 的订单推送飞书，并用带超时租约的数据库认领防并发重复。
 * 飞书消息 UUID 也按订单号固定，可覆盖“已发送但落库前进程退出”的极端情况。
 */
export async function notifyFeishuPaidOrderIfNeeded(
  supabase: ServiceClient,
  tradeOrderId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("claim_feishu_paid_notice", {
    p_trade_order_id: tradeOrderId,
  });
  if (error) {
    console.error("[paid-notice] 认领支付通知失败", error.message);
    return;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | ClaimedPaidOrder
    | null
    | undefined;
  if (!row) return;

  const sent = await sendFeishuPaidOrder({
    tradeOrderId: row.trade_order_id,
    productName: row.product_name,
    email: row.email,
    amountCents: row.amount_cents,
    paidAt: row.paid_at,
  });

  const updates = sent
    ? {
        feishu_paid_notice_sent_at: new Date().toISOString(),
        feishu_paid_notice_claimed_at: null,
      }
    : { feishu_paid_notice_claimed_at: null };
  const { error: finishError } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", row.order_id)
    .eq("status", "paid");

  if (finishError) {
    console.error("[paid-notice] 更新支付通知状态失败", finishError.message);
  }
  if (!sent) {
    console.error("[paid-notice] 飞书支付通知发送失败", tradeOrderId);
  }
}
