export type OrderState = "pending" | "paid" | "expired";

// Safe columns exposed to the public landing page (no secrets).
export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  sort_order: number;
  stock: number;
  image_url: string | null;
  contact_only: boolean; // 联系客服购买（不走自动发卡，无库存也不置灰）
}

// Full product row + stock counts, used by the admin panel.
export interface ProductWithStock {
  id: string;
  name: string;
  description: string | null;
  usage_notes: string | null;
  image_url: string | null;
  price_cents: number;
  is_active: boolean;
  contact_only: boolean;
  sort_order: number;
  created_at: string;
  stock: number;
  sold: number;
}

// One 卡密 row for per-product management in the admin panel.
export interface AdminCard {
  id: string;
  product_id: string;
  secret: string;
  status: "unsold" | "reserved" | "sold";
  order_id: string | null;
  sold_at: string | null;
  created_at: string;
}

export interface AdminOrder {
  id: string;
  product_id: string;
  product_name: string | null;
  trade_order_id: string;
  amount_cents: number;
  status: OrderState;
  card_id: string | null;
  card_secret: string | null; // 该订单发出的卡密内容（后台最近订单展示/换货）
  contact: string | null; // 下单买家联系方式（邮箱 / 自填联系方式）
  paid_at: string | null;
  created_at: string;
}

export interface OrderStatusPayload {
  status: OrderState;
  secret: string | null;
  stockOut: boolean;
  productName: string;
  expiresAt: string | null; // 待支付超时时间（ISO），供前端倒计时
}

// 教程卡片。每张卡片指向一个外部链接（飞书等），点卡片直接跳外链。
export interface Article {
  id: string;
  tag: string;
  title: string;
  summary: string;
  link_url: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 首页卡片只需这些字段。
export type ArticleCard = Pick<
  Article,
  "id" | "tag" | "title" | "summary" | "link_url"
>;
