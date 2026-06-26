import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import QRCode from "qrcode";
import { SiteHeader } from "@/components/SiteHeader";
import { PayPanel } from "@/components/PayPanel";
import { getBuyer } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { Price } from "@/components/Price";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const buyer = await getBuyer();
  if (!buyer) redirect(`/login?next=/order/${id}/pay`);

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, trade_order_id, status, amount_cents, pay_code, user_id, product_id, expires_at, products(name)",
    )
    .eq("id", id)
    .single();

  if (!order) notFound();
  if (order.user_id !== buyer.id) redirect("/"); // 只有本人能看自己的收银台
  if (order.status === "paid") redirect(`/order/${id}`); // 已付去卡密页

  const product = order.products as { name: string } | { name: string }[] | null;
  const productName = Array.isArray(product)
    ? (product[0]?.name ?? "商品")
    : (product?.name ?? "商品");

  const payCode = order.pay_code ?? "";
  const qrDataUrl = payCode
    ? await QRCode.toDataURL(payCode, { width: 280, margin: 1 })
    : null;

  return (
    <main className="flex-1">
      <SiteHeader />

      <div className="mx-auto max-w-md px-5 py-12">
        <h1 className="text-center text-xl font-semibold tracking-tight">
          微信扫码支付
        </h1>

        <div className="mt-2 text-center">
          <p className="text-sm text-muted">{productName}</p>
          <Price
            cents={order.amount_cents}
            className="mt-1 block text-3xl font-semibold tracking-tight"
          />
        </div>

        <div className="mt-6">
          <PayPanel
            orderId={id}
            productId={order.product_id}
            qrDataUrl={qrDataUrl}
            expiresAt={order.expires_at}
            initialExpired={order.status === "expired"}
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          订单号 <span className="font-mono">{order.trade_order_id}</span>
        </p>
        <div className="mt-2 text-center">
          <Link
            href="/"
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
