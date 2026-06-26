import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckoutOrderButton } from "@/components/CheckoutOrderButton";
import { getBuyer } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { Price } from "@/components/Price";

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
    .select("id, name, description, price_cents, is_active")
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
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          ← 返回首页
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          {/* 左：商品详情 */}
          <section>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">
                {product.description}
              </p>
            )}

            <dl className="mt-8 space-y-1 border-t border-line pt-6 text-sm text-muted">
              <div className="flex gap-2">
                <dt>支付方式：</dt>
                <dd className="text-ink">微信支付（扫码）</dd>
              </div>
              <div className="flex gap-2">
                <dt>发货方式：</dt>
                <dd className="text-ink">付款后自动发卡，订单页即时查看</dd>
              </div>
            </dl>
          </section>

          {/* 右：订单信息 */}
          <aside className="h-fit rounded-card border border-line bg-surface p-6 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold text-muted">订单信息</h2>
            <Price
              cents={product.price_cents}
              className="mt-2 block text-3xl font-semibold tracking-tight"
            />

            {/* 下单须知 */}
            <div className="mt-5 rounded-xl border border-warn/25 bg-warn/5 p-4 text-xs leading-relaxed text-ink/80">
              <p className="font-semibold text-ink">下单须知</p>
              <p className="mt-1.5">
                本商品为虚拟卡密，<b>付款后自动发货、一经发出不支持退款</b>。
                卡密会显示在订单页，并与你的登录邮箱绑定，可随时在「我的订单」找回。
                如遇卡密问题请保留订单号联系客服处理。
              </p>
            </div>

            {/* 绑定邮箱 */}
            <div className="mt-5">
              <p className="text-xs font-medium text-muted">收货邮箱（订单绑定）</p>
              <div className="mt-1 truncate rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
                {buyer.email}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                订单与卡密绑定此邮箱，请确保是你本人常用邮箱。
              </p>
            </div>

            {/* 下单 */}
            <div className="mt-6">
              {soldOut ? (
                <button
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-line bg-bg py-3 text-sm font-medium text-muted"
                >
                  该商品暂时缺货
                </button>
              ) : (
                <CheckoutOrderButton productId={product.id} />
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
