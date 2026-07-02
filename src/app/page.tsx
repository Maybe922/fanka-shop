import { Fragment } from "react";
import { Card, Chip } from "@heroui/react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { getPublicProducts, getPublishedArticles } from "@/lib/data";
import type { ArticleCard } from "@/lib/types";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic"; // always show fresh stock

const STEPS = [
  { t: "选择套餐", d: "挑选你需要的卡密套餐" },
  { t: "扫码支付", d: "使用微信扫码安全付款" },
  { t: "收到卡密", d: "30 秒内系统自动交付卡密" },
  { t: "充值使用", d: "按交付页指引前往充值站，输入卡密即可到账" },
];

const HERO_META = ["全程自动", "数秒到账", "微信支付", "卡密绑定邮箱可找回"];

export default async function Home() {
  const [products, articles] = await Promise.all([
    getPublicProducts(),
    getPublishedArticles(),
  ]);

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="hero-wash" />

          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 py-16 sm:py-24 lg:grid-cols-2 lg:gap-12">
            <div>
              <p
                className="reveal flex items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.18em] text-muted"
                style={{ animationDelay: "0ms" }}
              >
                <span className="live-dot" />
                自动发卡 · 实时在线
              </p>

              <h1 className="mt-6 max-w-3xl text-[2.75rem] font-bold leading-[1.04] tracking-[-0.02em] sm:text-7xl">
                <span className="reveal block" style={{ animationDelay: "80ms" }}>
                  划算稳定，
                </span>
                <span className="reveal block" style={{ animationDelay: "180ms" }}>
                  <span className="text-accent">AI</span> 订阅。
                </span>
              </h1>

              <p
                className="reveal mt-7 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base"
                style={{ animationDelay: "300ms" }}
              >
                无需等待人工。选好商品、扫码支付，卡密由系统即时分配——
                <span className="font-medium text-foreground">
                  全程自动，数秒送达。
                </span>
              </p>

              <ul
                className="reveal mt-8 flex flex-wrap items-center gap-2"
                style={{ animationDelay: "420ms" }}
              >
                {HERO_META.map((m) => (
                  <li key={m}>
                    <Chip variant="secondary" size="sm" className="bg-surface">
                      {m}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>

            {/* 右侧主视觉图 */}
            <div className="reveal" style={{ animationDelay: "260ms" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={site.heroImage}
                alt={site.name}
                width={960}
                height={960}
                className="mx-auto aspect-square w-full max-w-sm rounded-3xl border border-border object-cover shadow-[0_30px_70px_-32px_rgba(15,23,42,0.4)] sm:max-w-md lg:max-w-none"
              />
            </div>
          </div>
        </section>

        {/* ── Products ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
          <SectionHeading index="01" title="在售商品">
            <span className="font-mono text-[13px] text-muted">
              {String(products.length).padStart(2, "0")} 件在架
            </span>
          </SectionHeading>

          {products.length === 0 ? (
            <EmptyProducts />
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section id="how" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <SectionHeading index="02" title="购买流程" />

            <ol className="mt-12 flex flex-col gap-6 md:flex-row md:items-start md:gap-2">
              {STEPS.map((s, i) => (
                <Fragment key={s.t}>
                  <li className="flex flex-1 flex-col items-center text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent font-mono text-2xl font-bold text-accent-foreground shadow-[0_10px_22px_-10px_var(--accent)] transition-transform duration-300 hover:-translate-y-0.5">
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
                      <Chevron className="h-5 w-5 rotate-90 text-border md:rotate-0" />
                    </li>
                  )}
                </Fragment>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 相关教程 ──────────────────────────────────────── */}
        <section id="guides" className="mx-auto max-w-6xl px-5 py-16">
          <SectionHeading index="03" title="相关教程说明">
            <span className="hidden font-mono text-[13px] text-muted sm:inline">
              充值 · 使用 · 排错
            </span>
          </SectionHeading>

          {articles.length === 0 ? (
            <Card
              variant="secondary"
              className="mt-7 border border-dashed border-border px-6 py-16 text-center shadow-none"
            >
              <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted">
                no guides yet
              </p>
              <p className="mt-3 text-sm text-muted">教程整理中，敬请期待。</p>
            </Card>
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a, i) => (
                <GuideCard key={a.id} article={a} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-9 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={site.logoUrl}
              alt={site.name}
              width={28}
              height={28}
              className="h-7 w-7 rounded-md object-contain"
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

function SectionHeading({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between border-b border-border pb-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] font-semibold text-accent">
          [ {index} ]
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function GuideCard({ article, index }: { article: ArticleCard; index: number }) {
  const no = String(index + 1).padStart(2, "0");

  return (
    <a
      href={article.link_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full"
    >
      <Card className="flex h-full flex-col p-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <Chip size="sm" variant="secondary">
            {article.tag}
          </Chip>
          <span className="font-mono text-[11px] text-muted">A{no}</span>
        </div>

        <h3 className="mt-4 text-[16px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent">
          {article.title}
        </h3>
        {article.summary && (
          <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted">
            {article.summary}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-separator pt-3.5 text-[12px]">
          <span className="font-medium transition-colors group-hover:text-accent">
            阅读教程
          </span>
          <Chevron
            className="h-4 w-4 text-border transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-accent"
            aria-hidden
          />
        </div>
      </Card>
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

function EmptyProducts() {
  return (
    <Card
      variant="secondary"
      className="mt-7 border border-dashed border-border px-6 py-20 text-center shadow-none"
    >
      <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-muted">
        no items
      </p>
      <p className="mt-3 text-sm font-medium">暂时没有在售商品</p>
      <p className="mt-1.5 text-[13px] text-muted">
        请在后台
        <code className="mx-1 rounded bg-surface-tertiary px-1.5 py-0.5 font-mono text-xs">
          /admin
        </code>
        添加商品并进货卡密。
      </p>
    </Card>
  );
}
