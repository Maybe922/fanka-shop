import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { getPublicProducts } from "@/lib/data";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic"; // always show fresh stock

const STEPS = [
  { n: "01", t: "选择商品", d: "挑选你需要的卡密商品" },
  { n: "02", t: "扫码支付", d: "微信 / 支付宝 安全付款" },
  { n: "03", t: "自动发卡", d: "付款后立即拿到卡密" },
  { n: "04", t: "即买即用", d: "复制卡密，按说明使用" },
];

const FAQ = [
  {
    q: "付款后多久能拿到卡密？",
    a: "付款成功后系统会自动发卡，卡密通常在数秒内显示在订单页面。",
  },
  {
    q: "卡密页面要保存吗？",
    a: "建议截图或复制保存订单页链接。卡密只会发放给当前订单，请勿外泄。",
  },
  {
    q: "付了款却没收到卡密怎么办？",
    a: "极少数情况下若遇到库存不足，订单页会有提示，请联系客服为你处理。",
  },
];

export default async function Home() {
  const products = await getPublicProducts();

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-5 pb-4 pt-16 sm:pt-24">
          <p className="text-sm font-medium text-accent">{site.tagline}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            自助下单，
            <br />
            付款后秒发卡密。
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
            无需等待人工。选好商品、扫码支付，卡密立即送达——全程自动。
          </p>
        </section>

        {/* Products */}
        <section className="mx-auto max-w-5xl px-5 py-10">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">在售商品</h2>
            <span className="text-sm text-muted">{products.length} 件</span>
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

        {/* How it works */}
        <section id="how" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-14">
            <h2 className="text-xl font-semibold tracking-tight">购买流程</h2>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <span className="font-mono text-sm text-accent">{s.n}</span>
                  <h3 className="mt-2 text-base font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-xl font-semibold tracking-tight">常见问题</h2>
          <dl className="mt-6 divide-y divide-line">
            {FAQ.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="text-sm font-semibold">{item.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-muted">
          © {new Date().getFullYear()} {site.name}
        </div>
      </footer>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
      <p className="text-sm font-medium">暂时没有在售商品</p>
      <p className="mt-1.5 text-sm text-muted">
        请在后台
        <code className="mx-1 rounded bg-bg px-1.5 py-0.5 font-mono text-xs">
          /admin
        </code>
        添加商品并进货卡密。
      </p>
    </div>
  );
}
