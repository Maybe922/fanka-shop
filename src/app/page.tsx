import { Card } from "@heroui/react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { PurchaseDemo } from "@/components/purchase-demo/PurchaseDemo";
import { getPublicProducts } from "@/lib/data";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic"; // always show fresh stock

export default async function Home() {
  const products = await getPublicProducts();

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* 商品直接进入首屏，介绍保持紧凑。 */}
        <section
          id="products"
          aria-labelledby="products-title"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-12 pt-6 sm:pb-16 sm:pt-8"
        >
          <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="mb-2 font-mono text-[11px] tracking-[0.12em] text-muted">
                {site.name} · 产品目录
              </p>
              <h1
                id="products-title"
                className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
              >
                <span className="text-accent">AI 订阅</span>，按需选择
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-muted sm:text-sm">
                在线下单或联系客服，轻松开始使用。
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-mono text-xs text-muted sm:text-[13px]">
                {products.length} 款在售
              </span>
              <PurchaseDemo compact compactLabel="购买演示" />
            </div>
          </div>

          {products.length === 0 ? (
            <EmptyProducts />
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
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
