import Link from "next/link";
import { formatCny } from "@/lib/money";
import type { PublicProduct } from "@/lib/types";

export function ProductCard({ product }: { product: PublicProduct }) {
  const soldOut = product.stock < 1;

  return (
    <article className="flex flex-col rounded-card border border-line bg-surface p-6 transition-shadow hover:shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">{product.name}</h3>
        <StockBadge stock={product.stock} />
      </div>

      {product.description && (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted">
          {product.description}
        </p>
      )}

      <div className="mt-6 flex items-end justify-between">
        <span className="font-mono text-2xl font-semibold tracking-tight">
          {formatCny(product.price_cents)}
        </span>
      </div>

      <div className="mt-4">
        {soldOut ? (
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-line bg-bg py-2.5 text-sm font-medium text-muted"
          >
            无库存
          </button>
        ) : (
          <Link
            href={`/checkout/${product.id}`}
            className="block w-full rounded-xl bg-accent py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            立即购买
          </Link>
        )}
      </div>
    </article>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock < 1) {
    return (
      <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-xs text-muted">
        缺货
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok">
      库存 {stock}
    </span>
  );
}
