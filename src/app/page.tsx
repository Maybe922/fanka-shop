import { Fragment } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { getPublicProducts } from "@/lib/data";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic"; // always show fresh stock

const STEPS = [
  { t: "选择套餐", d: "挑选你需要的卡密套餐" },
  { t: "扫码支付", d: "使用微信扫码安全付款" },
  { t: "收到卡密", d: "30 秒内系统自动交付卡密" },
  { t: "充值使用", d: "按交付页指引前往充值站，输入卡密即可到账" },
];

const FAQ = [
  {
    q: "付款后多久能拿到卡密？",
    a: "付款成功后系统会自动发卡，卡密通常在数秒内显示在订单页面。",
  },
  {
    q: "卡密页面要保存吗？",
    a: "卡密与你的登录邮箱绑定，可随时在「订单中心」找回。也建议截图保存，请勿外泄。",
  },
  {
    q: "付了款却没收到卡密怎么办？",
    a: "极少数情况下若遇到库存不足，订单页会有提示，请保留订单号联系客服为你处理。",
  },
];

const HERO_META = ["全程自动", "数秒到账", "微信支付", "卡密绑定邮箱可找回"];

export default async function Home() {
  const products = await getPublicProducts();

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="hero-bg" />
          <div className="hero-glow" />
          {/* 印刷登记角标 */}
          <span className="reg-mark left-5 top-5" />
          <span className="reg-mark right-5 top-5" />

          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pb-24 sm:pt-24">
            <p
              className="reveal flex items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.18em] text-muted"
              style={{ animationDelay: "0ms" }}
            >
              <span className="live-dot" />
              自动发卡终端 · 实时在线
            </p>

            <h1 className="mt-6 max-w-3xl text-[2.75rem] font-bold leading-[1.04] tracking-[-0.02em] sm:text-7xl">
              <span
                className="reveal block"
                style={{ animationDelay: "80ms" }}
              >
                自助下单，
              </span>
              <span
                className="reveal block"
                style={{ animationDelay: "180ms" }}
              >
                付款后<span className="text-accent">秒</span>发卡密。
              </span>
            </h1>

            <p
              className="reveal mt-7 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base"
              style={{ animationDelay: "300ms" }}
            >
              无需等待人工。选好商品、扫码支付，卡密由系统即时分配——
              <span className="text-ink">全程自动，数秒送达。</span>
            </p>

            {/* 终端状态条 */}
            <ul
              className="reveal mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[12px] text-muted"
              style={{ animationDelay: "420ms" }}
            >
              {HERO_META.map((m, i) => (
                <li key={m} className="flex items-center gap-3">
                  {i > 0 && <span className="text-line">/</span>}
                  <span className="rounded-full border border-line bg-surface/60 px-3 py-1">
                    {m}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Products ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <div className="mb-7 flex items-end justify-between border-b border-line pb-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[12px] text-accent">[ 01 ]</span>
              <h2 className="text-xl font-semibold tracking-tight">在售商品</h2>
            </div>
            <span className="font-mono text-[13px] text-muted">
              {String(products.length).padStart(2, "0")} 件在架
            </span>
          </div>

          {products.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section id="how" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex items-baseline gap-3 border-b border-line pb-4">
              <span className="font-mono text-[12px] text-accent">[ 02 ]</span>
              <h2 className="text-xl font-semibold tracking-tight">购买流程</h2>
            </div>

            <ol className="mt-12 flex flex-col gap-6 md:flex-row md:items-start md:gap-2">
              {STEPS.map((s, i) => (
                <Fragment key={s.t}>
                  <li className="flex flex-1 flex-col items-center text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink font-mono text-2xl font-bold text-bg shadow-[0_8px_20px_-10px_rgba(27,23,19,0.55)] transition-transform duration-300 hover:-translate-y-0.5">
                      {i + 1}
                    </span>
                    <h3 className="mt-5 text-base font-semibold tracking-tight">
                      {s.t}
                    </h3>
                    <p className="mt-2 max-w-[15rem] text-[13px] leading-relaxed text-muted">
                      {s.d}
                    </p>
                  </li>
                  {i < STEPS.length - 1 && (
                    <li
                      aria-hidden
                      className="flex shrink-0 items-center justify-center md:w-6 md:pt-4"
                    >
                      <Chevron className="h-5 w-5 rotate-90 text-line md:rotate-0" />
                    </li>
                  )}
                </Fragment>
              ))}
            </ol>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section id="faq" className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex items-baseline gap-3 border-b border-line pb-4">
            <span className="font-mono text-[12px] text-accent">[ 03 ]</span>
            <h2 className="text-xl font-semibold tracking-tight">常见问题</h2>
          </div>
          <dl className="mt-4 divide-y divide-line">
            {FAQ.map((item, i) => (
              <div key={item.q} className="grid grid-cols-[auto_1fr] gap-x-4 py-6">
                <dt className="font-mono text-[12px] text-muted">
                  Q{String(i + 1).padStart(2, "0")}
                </dt>
                <div>
                  <dt className="text-[15px] font-semibold">{item.q}</dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-muted">
                    {item.a}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-9 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-ink font-mono text-xs font-bold text-bg">
              发
            </span>
            <span className="text-sm font-semibold">{site.name}</span>
          </div>
          <p className="font-mono text-[12px] text-muted">
            © {new Date().getFullYear()} · {site.tagline}
          </p>
        </div>
      </footer>
    </>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-6 py-20 text-center">
      <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted">
        no items
      </p>
      <p className="mt-3 text-sm font-medium">暂时没有在售商品</p>
      <p className="mt-1.5 text-[13px] text-muted">
        请在后台
        <code className="mx-1 rounded bg-sunken px-1.5 py-0.5 font-mono text-xs">
          /admin
        </code>
        添加商品并进货卡密。
      </p>
    </div>
  );
}
