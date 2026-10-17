import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBuyer } from "@/lib/supabase/auth-server";
import { queryXunhuOrder } from "@/lib/xunhupay";
import {
  notifyStockOutIfNeeded,
  notifyProductSoldOutIfNeeded,
} from "@/lib/alert";
import type { OrderStatusPayload } from "@/lib/types";
import { notifyFeishuPaidOrderIfNeeded } from "@/lib/paid-order-notice";

export const runtime = "nodejs";

const ORDER_COLS =
  "id, cancelled_at, status, card_id, product_id, expires_at, trade_order_id, user_id, payment_method";

// GET /api/orders/:id → order status (+ card secret once paid)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  let { data: order } = await supabase
    .from("orders")
    .select(ORDER_COLS)
    .eq("id", id)
    .single();

  if (!order) {
    return Response.json({ error: "订单不存在" }, { status: 404 });
  }

  // 归属校验：有主的订单只许本人查看——卡密是真金白银，不靠「UUID 难猜」兜底。
  // user_id 为空的是早期订单（下单尚未强制登录），保持可见以兼容。
  if (order.user_id) {
    const buyer = await getBuyer();
    if (!buyer || buyer.id !== order.user_id) {
      return Response.json({ error: "无权查看该订单" }, { status: 403 });
    }
  }

  // 过期只是本地库存状态；回调丢失时仍需向支付平台核实是否已付款。
  if (
    (order.status === "pending" || order.status === "expired") &&
    order.trade_order_id && order.payment_method === "wechat"
  ) {
    const q = await queryXunhuOrder(order.trade_order_id);
    if (q.paid) {
      const { error } = await supabase.rpc("deliver_order", {
        p_trade_order_id: order.trade_order_id,
      });
      if (error) {
        console.error("[orders] 发卡失败", error.message);
        return Response.json({ error: "支付已确认，发货处理中，请稍后重试" }, { status: 503 });
      }
      const { data: refreshed } = await supabase
        .from("orders")
        .select(ORDER_COLS)
        .eq("id", id)
        .single();
      if (refreshed) order = refreshed;
      if (order.status === "paid" && order.card_id) {
        await notifyProductSoldOutIfNeeded(supabase, order.product_id);
      }
    }
  }

  // 核实支付后仍未付款，才回收超时订单的预占库存。
  if (
    order.status === "pending" &&
    order.expires_at &&
    new Date(order.expires_at).getTime() < Date.now()
  ) {
    await supabase.rpc("expire_stale_orders");
    const { data: refreshed } = await supabase
      .from("orders")
      .select(ORDER_COLS)
      .eq("id", id)
      .single();
    if (refreshed) order = refreshed;
  }

  // 回调通知失败时，买家后续查看已付订单会再次尝试；数据库租约 + 消息 UUID 去重。
  if (order.status === "paid") {
    const paidTradeOrderId = order.trade_order_id;
    after(() => notifyFeishuPaidOrderIfNeeded(supabase, paidTradeOrderId));
  }

  // 已付但没卡 = 买家付了钱没拿到货 → 告警（原子去重，不会随轮询重复推）。
  if (order.status === "paid" && !order.card_id) {
    await notifyStockOutIfNeeded(supabase, order.id, order.trade_order_id);
  }

  let secret: string | null = null;
  if (order.status === "paid" && order.card_id) {
    const { data: card } = await supabase
      .from("cards")
      .select("secret")
      .eq("id", order.card_id)
      .eq("order_id", order.id)
      .eq("status", "sold")
      .single();
    secret = card?.secret ?? null;
  }

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", order.product_id)
    .single();

  let paymentState: OrderStatusPayload["paymentState"];
  if (["usdt_bep20", "usdt_trc20"].includes(order.payment_method)) {
    const { data } = await supabase.from("usdt_payments").select("state").eq("order_id", id).single();
    paymentState = data?.state;
  }
  const payload: OrderStatusPayload = {
    paymentState,
    cancelledAt: order.cancelled_at ?? null,
    status: order.status,
    secret,
    stockOut: order.status === "paid" && !order.card_id,
    productName: product?.name ?? "",
    expiresAt: order.expires_at ?? null,
  };
  return Response.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
