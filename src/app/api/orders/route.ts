import { createServiceClient } from "@/lib/supabase/server";
import { getBuyer } from "@/lib/supabase/auth-server";
import { createXunhuOrder } from "@/lib/xunhupay";
import { centsToYuanString } from "@/lib/money";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

// 每个买家同时最多挂这么多笔未支付订单。每笔会预占 1 张卡 20 分钟，
// 上限挡住「狂下单不付款、把小库存占空」让真买家看到缺货的薅法。
const MAX_PENDING_ORDERS = 3;

// POST /api/orders  { productId } → create an order + 虎皮椒 pay url
export async function POST(req: Request) {
  // 必须登录才能下单 —— 订单绑定买家身份（user_id + email），便于找回卡密。
  const buyer = await getBuyer();
  if (!buyer) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

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

  // 先回收超时未付订单的库存，让本次下单能用上释放出来的卡。
  await supabase.rpc("expire_stale_orders");

  // 限流：挡住单账号囤积未付订单挤占库存（先过期清理，再数当前还挂着的）。
  const { count: pendingCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", buyer.id)
    .eq("status", "pending");
  if ((pendingCount ?? 0) >= MAX_PENDING_ORDERS) {
    return Response.json(
      { error: "你有多笔未完成的订单，请先付款或等它们超时后再下单" },
      { status: 429 },
    );
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, name, price_cents, is_active")
    .eq("id", productId)
    .eq("is_active", true)
    .single();

  if (!product) {
    return Response.json({ error: "商品不存在或已下架" }, { status: 404 });
  }

  const tradeOrderId = `FK${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString(); // 20 分钟

  // 原子下单 + 预占 1 张卡（库存随之 -1）。无卡返回 null → 缺货。
  const { data: orderId, error: reserveErr } = await supabase.rpc(
    "create_order_reserved",
    {
      p_product_id: productId,
      p_trade_order_id: tradeOrderId,
      p_amount_cents: product.price_cents,
      p_user_id: buyer.id,
      p_email: buyer.email ?? null,
      p_expires_at: expiresAt,
    },
  );

  if (reserveErr) {
    console.error("[orders] 预占失败", reserveErr.message);
    return Response.json({ error: "下单失败，请重试" }, { status: 500 });
  }
  if (!orderId) {
    return Response.json({ error: "该商品暂时缺货" }, { status: 409 });
  }

  const siteUrl = publicEnv.siteUrl || new URL(req.url).origin;

  const result = await createXunhuOrder({
    tradeOrderId,
    totalFeeYuan: centsToYuanString(product.price_cents),
    title: product.name,
    notifyUrl: `${siteUrl}/api/notify`,
    returnUrl: `${siteUrl}/order/${orderId}`,
  });

  if (!result.payUrl) {
    console.error("[orders] 虎皮椒下单失败", result.raw);
    // 回滚：释放预占的卡 + 删除订单，库存恢复。
    await supabase.rpc("cancel_order", { p_order_id: orderId });
    return Response.json({ error: "发起支付失败，请稍后重试" }, { status: 502 });
  }

  // 存下原始 weixin:// 支付码（自建收银台用）；解析失败存 hosted payUrl 兜底。
  await supabase
    .from("orders")
    .update({ pay_code: result.qrCode ?? result.payUrl })
    .eq("id", orderId);

  return Response.json({ orderId });
}
