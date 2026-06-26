import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
import type {
  PublicProduct,
  ProductWithStock,
  AdminOrder,
  AdminCard,
} from "@/lib/types";

// Landing page: only safe columns via the public_products view.
// Returns [] (instead of throwing) when Supabase isn't configured yet,
// so the site still renders before setup is complete.
export async function getPublicProducts(): Promise<PublicProduct[]> {
  if (!hasSupabaseConfig()) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("public_products")
      .select("id, name, description, price_cents, sort_order, stock, image_url");
    if (error) {
      console.error("[getPublicProducts]", error.message);
      return [];
    }
    return (data ?? []) as PublicProduct[];
  } catch (err) {
    console.error("[getPublicProducts]", err);
    return [];
  }
}

export async function getAdminProducts(): Promise<ProductWithStock[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("product_stock")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductWithStock[];
}

// 机会式回收：把超时未付订单标记过期并释放预占卡。后台加载时调用。
export async function expireStaleOrders(): Promise<void> {
  const supabase = createServiceClient();
  await supabase.rpc("expire_stale_orders");
}

// All 卡密 across products, newest first — grouped per product by the admin page.
export async function getAllCards(): Promise<AdminCard[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cards")
    .select("id, product_id, secret, status, order_id, sold_at, created_at")
    .order("status", { ascending: false }) // 'unsold' > 'sold'：未售（可用）在前
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminCard[];
}

// 后台「节点概览」用的聚合统计：已付订单总数 + 总销售额（分）。
// 不限于最近 N 单，扫描全部已付订单求和（小店量级开销可忽略）。
export async function getPaidOrderStats(): Promise<{
  soldOrders: number;
  revenueCents: number;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("amount_cents")
    .eq("status", "paid");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const revenueCents = rows.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
  return { soldOrders: rows.length, revenueCents };
}

export async function getRecentOrders(limit = 50): Promise<AdminOrder[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, product_id, trade_order_id, amount_cents, status, card_id, paid_at, created_at, products(name), cards(secret)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const product = row.products as { name: string } | { name: string }[] | null;
    const productName = Array.isArray(product)
      ? (product[0]?.name ?? null)
      : (product?.name ?? null);
    const card = row.cards as { secret: string } | { secret: string }[] | null;
    const cardSecret = Array.isArray(card)
      ? (card[0]?.secret ?? null)
      : (card?.secret ?? null);
    return {
      id: row.id,
      product_id: row.product_id,
      product_name: productName,
      trade_order_id: row.trade_order_id,
      amount_cents: row.amount_cents,
      status: row.status,
      card_id: row.card_id,
      card_secret: cardSecret,
      paid_at: row.paid_at,
      created_at: row.created_at,
    } satisfies AdminOrder;
  });
}

// 某买家本人的订单（订单中心用）。凭登录态的 user_id 过滤，服务端读取。
export async function getMyOrders(userId: string): Promise<AdminOrder[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, product_id, trade_order_id, amount_cents, status, card_id, paid_at, created_at, products(name)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const product = row.products as { name: string } | { name: string }[] | null;
    const productName = Array.isArray(product)
      ? (product[0]?.name ?? null)
      : (product?.name ?? null);
    return {
      id: row.id,
      product_id: row.product_id,
      product_name: productName,
      trade_order_id: row.trade_order_id,
      amount_cents: row.amount_cents,
      status: row.status,
      card_id: row.card_id,
      card_secret: null, // 订单中心列表不展示卡密（买家在订单详情页查看）
      paid_at: row.paid_at,
      created_at: row.created_at,
    } satisfies AdminOrder;
  });
}
