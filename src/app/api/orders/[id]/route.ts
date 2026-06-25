import { createServiceClient } from "@/lib/supabase/server";
import type { OrderStatusPayload } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/orders/:id → order status (+ card secret once paid)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  let { data: order } = await supabase
    .from("orders")
    .select("id, status, card_id, product_id, expires_at")
    .eq("id", id)
    .single();

  if (!order) {
    return Response.json({ error: "订单不存在" }, { status: 404 });
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
      .select("id, status, card_id, product_id, expires_at")
      .eq("id", id)
      .single();
    if (refreshed) order = refreshed;
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
