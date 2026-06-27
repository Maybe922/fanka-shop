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

// 相关教程：充值/使用类文章。href 填真实链接（外链 http(s):// 或站内路径）；
// 留空则该条显示「敬请期待」、不可点，避免死链。
type Guide = {
  tag: string;
  title: string;
  summary: string;
  href: string;
};

const GUIDES: Guide[] = [
  {
    tag: "充值教程",
    title: "ChatGPT Plus 卡密充值图文教程",
    summary: "从打开充值站到卡密到账，每一步配图说明，第一次买也能照着做。",
    href: "",
  },
  {
    tag: "充值教程",
    title: "Claude Pro 订阅开通与使用指南",
    summary: "卡密如何兑换、额度怎么看、常见限制说明，开通后照着用。",
    href: "",
  },
  {
    tag: "常见问题",
    title: "卡密充值报错 / 无法到账的排查清单",
    summary: "按顺序自查：链接是否正确、卡密是否输全、地区与浏览器设置。",
    href: "",
  },
];

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

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

          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 py-16 sm:py-24 lg:grid-cols-2 lg:gap-12">
            <div>
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
                划算稳定，
              </span>
              <span
                className="reveal block"
                style={{ animationDelay: "180ms" }}
              >
                <span className="text-accent">AI</span> 订阅。
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

            {/* 右侧主视觉图 */}
            <div
              className="reveal"
              style={{ animationDelay: "260ms" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={site.heroImage}
                alt={site.name}
                width={960}
                height={960}
                className="mx-auto aspect-square w-full max-w-sm rounded-[1.75rem] border border-line object-cover shadow-[0_30px_70px_-32px_rgba(27,23,19,0.5)] sm:max-w-md lg:max-w-none"
              />
            </div>
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

        {/* ── 相关教程 ──────────────────────────────────────── */}
        <section id="guides" className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex items-end justify-between border-b border-line pb-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[12px] text-accent">[ 03 ]</span>
              <h2 className="text-xl font-semibold tracking-tight">相关教程说明</h2>
            </div>
            <span className="hidden font-mono text-[13px] text-muted sm:inline">
              充值 · 使用 · 排错
            </span>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES.map((g, i) => (
              <GuideCard key={g.title} guide={g} index={i} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-9 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={site.logoUrl}
              alt={site.name}
              width={28}
              height={28}
              className="h-7 w-7 rounded-[6px] object-contain"
            />
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

function GuideCard({ guide, index }: { guide: Guide; index: number }) {
  const no = String(index + 1).padStart(2, "0");
  const hasLink = guide.href.trim().length > 0;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-line bg-bg px-2.5 py-0.5 font-mono text-[11px] text-muted">
          {guide.tag}
        </span>
        <span className="font-mono text-[11px] text-muted">A{no}</span>
      </div>

      <h3 className="mt-4 text-[16px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent">
        {guide.title}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted">
        {guide.summary}
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-3.5 font-mono text-[12px]">
        {hasLink ? (
          <>
            <span className="text-ink transition-colors group-hover:text-accent">
              阅读教程
            </span>
            <Chevron
              className="h-4 w-4 text-line transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-accent"
              aria-hidden
            />
          </>
        ) : (
          <span className="text-muted/70">敬请期待</span>
        )}
      </div>
    </>
  );

  const card =
    "group flex flex-col rounded-card border border-line bg-surface p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]";

  if (!hasLink) {
    return <div className={card}>{inner}</div>;
  }

  const external = isExternal(guide.href);
  return (
    <a
      href={guide.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${card} transition-all duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_18px_40px_-22px_rgba(27,23,19,0.4)]`}
    >
      {inner}
    </a>
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
