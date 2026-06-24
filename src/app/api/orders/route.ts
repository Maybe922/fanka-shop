import { createServiceClient } from "@/lib/supabase/server";
import { createXunhuOrder } from "@/lib/xunhupay";
import { centsToYuanString } from "@/lib/money";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

// POST /api/orders  { productId } → create an order + 虎皮椒 pay url
export async function POST(req: Request) {
  let productId: string;
  try {
    const body = (await req.json()) as { productId?: string };
    productId = String(body.productId ?? "");
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  if (!productId) {
    return Response.json({ error: "缺少商品" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, price_cents, is_active")
    .eq("id", productId)
    .eq("is_active", true)
    .single();

  if (!product) {
    return Response.json({ error: "商品不存在或已下架" }, { status: 404 });
  }

  // Stock check (final assignment is still atomic in deliver_order).
  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "unsold");

  if (!count || count < 1) {
    return Response.json({ error: "该商品暂时缺货" }, { status: 409 });
  }

  const tradeOrderId = `FK${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      product_id: productId,
      trade_order_id: tradeOrderId,
      amount_cents: product.price_cents,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    return Response.json({ error: "下单失败，请重试" }, { status: 500 });
  }

  const siteUrl = publicEnv.siteUrl || new URL(req.url).origin;

  const result = await createXunhuOrder({
    tradeOrderId,
    totalFeeYuan: centsToYuanString(product.price_cents),
    title: product.name,
    notifyUrl: `${siteUrl}/api/notify`,
    returnUrl: `${siteUrl}/order/${order.id}`,
  });

  if (!result.payUrl) {
    console.error("[orders] 虎皮椒下单失败", result.raw);
    return Response.json({ error: "发起支付失败，请稍后重试" }, { status: 502 });
  }

  return Response.json({ orderId: order.id, payUrl: result.payUrl });
}
