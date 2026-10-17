import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ContactBuyButton } from "@/components/ContactBuyButton";
import { site } from "@/lib/site";
import { RedemptionDemo } from "@/components/purchase-demo/RedemptionDemo";
import { PurchaseDemo } from "@/components/purchase-demo/PurchaseDemo";

export const metadata: Metadata = { title: `帮助中心 · ${site.name}` };

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-12">
        <Link href="/" className="text-sm text-muted hover:text-foreground">← 返回商品目录</Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">帮助中心</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">从选择商品到查看订单，在这里找到购买和使用指引。</p>

        <div className="mt-7"><PurchaseDemo /></div>
        <div id="redemption-demo" className="mt-4 scroll-mt-24"><RedemptionDemo featured /></div>

        <section aria-labelledby="buying-heading" className="mt-9">
          <h2 id="buying-heading" className="text-xl font-semibold">购买流程</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-semibold">在线自助购买</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-muted">
                <li>选择有库存的商品，点击「立即购买」。</li>
                <li>使用邮箱验证码登录，确认商品和金额。</li>
                <li>选择微信或 USDT，按收银台提示完成付款。</li>
                <li>付款后，在订单详情页查看卡密与使用说明。</li>
                <li>按交付页指引前往充值站，输入卡密完成充值。</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-semibold">联系客服购买</h3>
              <p className="mt-3 text-sm leading-7 text-muted">标有「客服定制」的商品，请点击「联系购买」，通过微信或 Telegram 联系客服，确认套餐、充值方式和交付安排后再购买。</p>
              <p className="mt-3 text-sm leading-7 text-muted">不同商品的适用条件与售后说明，请以对应商品详情及客服确认为准。</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="orders-heading" className="mt-9 rounded-2xl border border-border p-5 sm:p-6">
          <h2 id="orders-heading" className="text-xl font-semibold">订单与卡密</h2>
          <p className="mt-3 text-sm leading-7 text-muted">网站自助订单会绑定下单时使用的邮箱。使用同一邮箱登录后，在右上角「账户 → 我的订单」中继续支付或查看已购卡密。</p>
          <Link href="/orders" className="mt-4 inline-flex text-sm font-medium text-accent hover:underline">查看我的订单 →</Link>
        </section>

        <section aria-labelledby="faq-heading" className="mt-9">
          <h2 id="faq-heading" className="text-xl font-semibold">常见问题</h2>
          <div className="mt-4 divide-y divide-border rounded-2xl border border-border px-5">
            <details className="py-4">
              <summary className="cursor-pointer text-sm font-medium">收不到登录验证码怎么办？</summary>
              <p className="mt-3 text-sm leading-7 text-muted">先确认邮箱填写正确，再检查垃圾邮件。稍后重试仍未收到时，可通过右上角「客服」联系我们。</p>
            </details>
            <details className="py-4">
              <summary className="cursor-pointer text-sm font-medium">付款后没有看到卡密怎么办？</summary>
              <p className="mt-3 text-sm leading-7 text-muted">先回到订单详情页查看状态。如果仍未显示卡密，请联系人工客服并提供订单号，方便核查付款和交付情况。</p>
            </details>
            <details className="py-4">
              <summary className="cursor-pointer text-sm font-medium">商品显示缺货，还能购买吗？</summary>
              <p className="mt-3 text-sm leading-7 text-muted">缺货商品暂时无法自助下单。可以稍后查看库存，或联系客服咨询补货情况。</p>
            </details>
          </div>
        </section>

        <section className="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">还需要帮助？</h2>
            <p className="mt-1 text-sm text-muted">告诉我们你遇到的问题，客服会协助处理。</p>
          </div>
          <ContactBuyButton label="联系客服" />
        </section>
      </main>
    </>
  );
}
