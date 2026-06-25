import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { OrderStatusView } from "@/components/OrderStatusView";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 展示商户订单号（FK...）而非内部 UUID，便于和后台/客服对账。
  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("trade_order_id")
    .eq("id", id)
    .single();
  const orderNo = order?.trade_order_id ?? id;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-5 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">订单详情</h1>
          <p className="mt-1.5 font-mono text-xs text-muted">订单号 {orderNo}</p>

          <div className="mt-8">
            <OrderStatusView orderId={id} />
          </div>

          <Link
            href="/"
            className="mt-8 inline-block text-sm text-accent transition-colors hover:text-accent-hover"
          >
            ← 返回继续购买
          </Link>
        </section>
      </main>
    </>
  );
}
