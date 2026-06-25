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
