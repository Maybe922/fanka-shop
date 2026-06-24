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

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, card_id, product_id")
    .eq("id", id)
    .single();

  if (!order) {
    return Response.json({ error: "订单不存在" }, { status: 404 });
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
  };
  return Response.json(payload);
}
