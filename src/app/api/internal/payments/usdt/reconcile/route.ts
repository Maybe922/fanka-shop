import { timingSafeEqual } from "node:crypto";
import { reconcileUsdtPayments } from "@/lib/bep20/server";
import { reconcileTrc20Payments } from "@/lib/trc20/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyFeishuPaidOrderIfNeeded } from "@/lib/paid-order-notice";
import { notifyProductSoldOutIfNeeded, notifyStockOutIfNeeded } from "@/lib/alert";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.USDT_RECONCILE_SECRET;
  const actual = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !actual || Buffer.byteLength(expected) !== Buffer.byteLength(actual) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Keep reconciling existing quotes even if creation of new USDT orders is disabled.
    const results = await Promise.allSettled([reconcileUsdtPayments(), reconcileTrc20Payments()]);
    const result = { delivered: [] as string[], reviewed: [] as string[] };
    for (const r of results) {
      if (r.status === "fulfilled") { result.delivered.push(...r.value.delivered); result.reviewed.push(...r.value.reviewed); }
    }
    const db = createServiceClient();
    for (const id of result.delivered) {
      const { data: order } = await db.from("orders").select("id,trade_order_id,product_id,card_id,status").eq("id", id).single();
      if (order?.status === "paid") {
        await notifyFeishuPaidOrderIfNeeded(db, order.trade_order_id);
        if (order.card_id) await notifyProductSoldOutIfNeeded(db, order.product_id);
        else await notifyStockOutIfNeeded(db, order.id, order.trade_order_id);
      }
    }
    if (result.reviewed.length) console.warn("[usdt] Late payments require review:", result.reviewed);
    if (results.some(r => r.status === "rejected")) throw new Error("One network unavailable");
    return Response.json({ settled: result.delivered.length, needsReview: result.reviewed.length });
  } catch {
    console.error("[usdt] Reconciliation incomplete; retry on next scheduled run");
    return Response.json({ error: "Reconciliation unavailable" }, { status: 503 });
  }
}
