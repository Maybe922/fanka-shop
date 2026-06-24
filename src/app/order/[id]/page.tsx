import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { OrderStatusView } from "@/components/OrderStatusView";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-5 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">订单详情</h1>
          <p className="mt-1.5 font-mono text-xs text-muted">订单号 {id}</p>

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
