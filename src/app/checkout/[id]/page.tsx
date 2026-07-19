import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Alert, Button, Card } from "@heroui/react";
import { ContactBuyButton } from "@/components/ContactBuyButton";
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

            <dl className="mt-8 space-y-1 border-t border-separator pt-6 text-sm text-muted">
              <div className="flex gap-2">
                <dt>支付方式：</dt>
                <dd className="text-foreground">微信支付（扫码）</dd>
              </div>
              <div className="flex gap-2">
                <dt>发货方式：</dt>
                <dd className="text-foreground">
                  付款后自动发卡，订单页即时查看
                </dd>
              </div>
            </dl>
          </section>

          {/* 右：订单信息 */}
          <Card className="h-fit p-6 lg:sticky lg:top-20">
            <h2 className="text-sm font-semibold text-muted">订单信息</h2>
            <Price
              cents={product.price_cents}
              className="mt-2 flex items-baseline text-3xl font-semibold tracking-tight"
              symbolClassName="mr-0.5 text-xl text-accent"
            />

            {/* 下单须知 */}
            <Alert status="warning" className="mt-5">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>下单须知</Alert.Title>
                <Alert.Description>
                  本商品为虚拟卡密，<b>付款后自动发货、一经发出不支持退款</b>。
                  卡密会显示在订单页，并与你的登录邮箱绑定，可随时在「我的订单」找回。
                  如遇卡密问题请保留订单号联系客服处理。
                </Alert.Description>
              </Alert.Content>
            </Alert>

            {/* 绑定邮箱 */}
            <div className="mt-5">
              <p className="text-xs font-medium text-muted">
                收货邮箱（订单绑定）
              </p>
              <div className="mt-1.5 truncate rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm">
                {buyer.email}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                订单与卡密绑定此邮箱，请确保是你本人常用邮箱。
              </p>
            </div>

            {/* 下单。客服定制商品不走在线支付，弹微信二维码联系。 */}
            <div className="mt-6">
              {product.contact_only ? (
                <ContactBuyButton fullWidth label="联系客服购买" />
              ) : soldOut ? (
                <Button isDisabled variant="tertiary" fullWidth size="lg">
                  该商品暂时缺货
                </Button>
              ) : (
                <CheckoutOrderButton productId={product.id} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
