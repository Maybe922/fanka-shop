import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { ContactBuyButton } from "@/components/ContactBuyButton";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutOrderButton } from "@/components/CheckoutOrderButton";
import { getBuyer } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { CheckoutInfo } from "@/components/CheckoutInfo";
import { Price } from "@/components/Price";
import { usdtEnabled } from "@/lib/bep20/server";
import { trc20Enabled } from "@/lib/trc20/server";
import { expireStaleOrders } from "@/lib/data";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // 必须登录才能下单 —— 未登录跳登录页，登录后回到本结账页。
  const buyer = await getBuyer();
  if (!buyer) redirect(`/login?next=/checkout/${id}`);

  const supabase = createServiceClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, price_cents, is_active, contact_only")
    .eq("id", id)
    .single();

  if (!product || !product.is_active) {
    return (
      <main className="flex-1">
        <SiteHeader />
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <p className="text-base font-medium">商品不存在或已下架</p>
          <Link href="/" className="mt-4 inline-block text-sm text-accent">
            ← 返回首页
          </Link>
        </div>
      </main>
    );
  }

  await expireStaleOrders();
  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id)
    .eq("status", "unsold");
  const soldOut = !count || count < 1;

  return (
    <main className="flex-1">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 py-10">
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          ← 返回首页
        </Link>

        <div className="mt-6 lg:pr-[412px]">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-7 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* 两列共用同一行起点，标题换行时仍保持顶部对齐。 */}
          <section aria-label="商品购买说明">
            <CheckoutInfo contactOnly={product.contact_only} usdtAvailable={usdtEnabled()} trc20Available={trc20Enabled()} />
          </section>

          {/* 右：订单信息 */}
          <Card className="h-fit p-6 lg:sticky lg:top-20">
            <h2 className="text-sm font-semibold text-muted">订单信息</h2>


            {/* 下单。客服定制商品不走在线支付，弹微信二维码联系。 */}
            <div>
              {product.contact_only ? (
                <>
                  <Price cents={product.price_cents} className="mt-2 flex items-baseline text-3xl font-semibold tracking-tight" symbolClassName="mr-0.5 text-xl text-accent" />
                  <div className="mt-6"><ContactBuyButton fullWidth label="联系客服购买" /></div>
                </>
              ) : (
                <CheckoutOrderButton productId={product.id} priceCents={product.price_cents} soldOut={soldOut} usdtAvailable={usdtEnabled()} trc20Available={trc20Enabled()} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
