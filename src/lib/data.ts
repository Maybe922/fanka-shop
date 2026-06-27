import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";
import type {
  PublicProduct,
  ProductWithStock,
  AdminOrder,
  AdminCard,
  Article,
  ArticleCard,
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

// ── 教程文章 ────────────────────────────────────────────────────

// 首页「相关教程说明」卡片：仅已发布、且填了外链，按 sort_order/创建时间。
// 服务端渲染（首页是 server component），用 service 客户端直接读，无需公开视图。
export async function getPublishedArticles(): Promise<ArticleCard[]> {
  if (!hasSupabaseConfig()) return [];
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("articles")
      .select("id, tag, title, summary, link_url")
      .eq("is_published", true)
      .neq("link_url", "")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[getPublishedArticles]", error.message);
      return [];
    }
    return (data ?? []) as ArticleCard[];
  } catch (err) {
    console.error("[getPublishedArticles]", err);
    return [];
  }
}

// 后台文章列表：含草稿，按 sort_order/创建时间。
// 表未迁移（articles 不存在）时返回 []，避免整个后台连商品都打不开。
export async function getAdminArticles(): Promise<Article[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getAdminArticles]", error.message);
    return [];
  }
  return (data ?? []) as Article[];
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

// 后台订单分页：每页 pageSize 条，按时间倒序，附总数用于翻页。
export async function getOrdersPage(
  page = 1,
  pageSize = 20,
): Promise<{ orders: AdminOrder[]; total: number }> {
  const supabase = createServiceClient();
  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("orders")
    .select(
      "id, product_id, trade_order_id, amount_cents, status, card_id, email, contact, paid_at, created_at, products(name), cards(secret)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);

  const orders = (data ?? []).map((row) => {
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
      contact: row.email ?? row.contact ?? null,
      paid_at: row.paid_at,
      created_at: row.created_at,
    } satisfies AdminOrder;
  });

  return { orders, total: count ?? 0 };
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
      contact: null, // 买家本人订单页不展示联系方式
      paid_at: row.paid_at,
      created_at: row.created_at,
    } satisfies AdminOrder;
  });
}
