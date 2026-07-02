import { createServiceClient } from "@/lib/supabase/server";
import { getBuyer } from "@/lib/supabase/auth-server";
import { queryXunhuOrder } from "@/lib/xunhupay";
import {
  notifyStockOutIfNeeded,
  notifyProductSoldOutIfNeeded,
} from "@/lib/alert";
import type { OrderStatusPayload } from "@/lib/types";

export const runtime = "nodejs";

const ORDER_COLS =
  "id, status, card_id, product_id, expires_at, trade_order_id, user_id";

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

  // 待支付且已超时 → 触发过期清理（释放预占卡），再回读最新状态。
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

  // 仍待支付 → 主动向虎皮椒查单（不依赖回调能否打进来）。已付则立即发卡。
  if (order.status === "pending" && order.trade_order_id) {
    const q = await queryXunhuOrder(order.trade_order_id);
    if (q.paid) {
      await supabase.rpc("deliver_order", {
        p_trade_order_id: order.trade_order_id,
      });
      const { data: refreshed } = await supabase
        .from("orders")
        .select(ORDER_COLS)
        .eq("id", id)
        .single();
      if (refreshed) order = refreshed;
      // 本次查单触发了发卡 → 若该商品因此售罄，推补货提醒（内部去重）。
      if (order.status === "paid" && order.card_id) {
        await notifyProductSoldOutIfNeeded(supabase, order.product_id);
      }
    }
  }

  // 已付但没卡 = 买家付了钱没拿到货 → 告警（原子去重，不会随轮询重复推）。
  if (order.status === "paid" && !order.card_id) {
    await notifyStockOutIfNeeded(supabase, order.id, order.trade_order_id);
  }

  let secret: string | null = null;
  if (order.card_id) {
    const { data: card } = await supabase
      .from("cards")
      .select("secret")
      .eq("id", order.card_id)
      .single();
    secret = card?.secret ?? null;
  }

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", order.product_id)
    .single();

  const payload: OrderStatusPayload = {
    status: order.status,
    secret,
    stockOut: order.status === "paid" && !order.card_id,
    productName: product?.name ?? "",
    expiresAt: order.expires_at ?? null,
  };
  return Response.json(payload);
}
