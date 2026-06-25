import Link from "next/link";
import { formatCny } from "@/lib/money";
import type { PublicProduct } from "@/lib/types";

export function ProductCard({ product }: { product: PublicProduct }) {
  const soldOut = product.stock < 1;

  return (
    <article className="ticket group relative flex flex-col rounded-card border border-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_18px_40px_-22px_rgba(27,23,19,0.4)]">
      {/* 封面图（有才显示） */}
      {product.image_url && (
        <div className="overflow-hidden rounded-t-card border-b border-line bg-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}

      {/* 票根头部 */}
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            卡密 / voucher
          </p>
          <h3 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight">
            {product.name}
          </h3>
        </div>
        <StockBadge stock={product.stock} />
      </div>

      {/* 撕裂打孔线（左右缺口骑在卡片边缘） */}
      <div className="ticket-perf" />

      {/* 票据正文 */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        {product.description && (
          <p className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-muted">
            {product.description}
          </p>
        )}

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              单价
            </p>
            <p className="mt-0.5 flex items-baseline font-mono text-[26px] font-semibold leading-[1.25] tracking-tight">
              <span className="mr-0.5 text-accent">¥</span>
              {(product.price_cents / 100).toLocaleString("zh-CN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {soldOut ? (
            <button
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-dashed border-line bg-sunken py-2.5 font-mono text-[13px] font-medium text-muted"
            >
              SOLD OUT · 暂时缺货
            </button>
          ) : (
            <Link
              href={`/checkout/${product.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent"
            >
              立即购买
              <span className="cta-arrow font-mono">→</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock < 1) {
    return (
      <span className="shrink-0 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted">
        0
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 font-mono text-[11px] font-medium text-ok">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" />库存 {stock}
    </span>
  );
}
