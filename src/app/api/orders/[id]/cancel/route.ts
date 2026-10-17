import { getBuyer } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { queryXunhuOrder } from "@/lib/xunhupay";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  const expectedOrigin = new URL(publicEnv.siteUrl || req.url).origin;
  if (origin !== expectedOrigin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const buyer = await getBuyer();
  if (!buyer) return Response.json({ error: "请先登录后再操作" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "订单不存在" }, { status: 404 });
  }
  const db = createServiceClient();
  const { data: order, error } = await db.from("orders")
    .select("id, user_id, status, cancelled_at, payment_method, trade_order_id")
    .eq("id", id).eq("user_id", buyer.id).single();
  if (error || !order) return Response.json({ error: "订单不存在或无权操作" }, { status: 404 });
  if (order.status === "paid") return Response.json({ status: "paid", error: "订单已付款，不能取消" }, { status: 409 });
  // 微信查单失败时不将未知结果当作未付款。
  if (order.status === "pending" && order.payment_method === "wechat") {
    const payment = await queryXunhuOrder(order.trade_order_id);
    if (payment.paid) return Response.json({ status: "paid", error: "支付已确认，请查看订单" }, { status: 409 });
    if (!payment.status) return Response.json({ error: "暂时无法确认付款状态，请稍后重试" }, { status: 503 });
  }
  const result = await db.rpc("cancel_buyer_order", { p_order_id: id, p_user_id: buyer.id });
  if (result.error) return Response.json({ error: "取消失败，请稍后重试" }, { status: 503 });
  if (result.data === "cancelled") return Response.json({ status: "cancelled" });
  const messages: Record<string, string> = {
    paid: "订单已付款，不能取消", review: "付款正在核验，请联系客服", expired: "订单已结束，请查看订单", not_found: "订单不存在或无权操作",
  };
  return Response.json({ status: result.data, error: messages[result.data] || "订单状态已变化，请刷新查看" }, { status: result.data === "not_found" ? 404 : 409 });
}
