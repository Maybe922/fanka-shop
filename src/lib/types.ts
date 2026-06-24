export type OrderState = "pending" | "paid";

// Safe columns exposed to the public landing page (no secrets).
export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  sort_order: number;
  stock: number;
}

// Full product row + stock counts, used by the admin panel.
export interface ProductWithStock {
  id: string;
  name: string;
  description: string | null;
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
  status: "unsold" | "sold";
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
  paid_at: string | null;
  created_at: string;
}

export interface OrderStatusPayload {
  status: OrderState;
  secret: string | null;
  stockOut: boolean;
  productName: string;
}
