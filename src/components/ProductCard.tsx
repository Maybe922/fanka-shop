import Link from "next/link";
import { Button, Card, Chip, buttonVariants } from "@heroui/react";
import { ContactBuyButton } from "@/components/ContactBuyButton";
import { Price } from "@/components/Price";
import { site } from "@/lib/site";
import type { PublicProduct } from "@/lib/types";

export function ProductCard({ product }: { product: PublicProduct }) {
  // 客服定制商品不走库存逻辑：无卡密也不置灰，按钮换成「联系购买」。
  const contactOnly = product.contact_only;
  const soldOut = !contactOnly && product.stock < 1;

  return (
    // 缺货卡「半灰」：图片去饱和 + 整卡降透明度、不上浮——一眼可辨但不至于满页死灰。
    <Card
      className={`relative flex flex-col overflow-hidden p-0 ${
        soldOut
          ? "opacity-70"
          : "group transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgba(30,20,10,0.35)]"
      }`}
    >
      {/* 封面图（有才显示） */}
      {product.image_url && (
        <div className="overflow-hidden border-b border-separator bg-surface-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className={`aspect-[16/9] w-full object-cover ${
              soldOut
                ? "grayscale"
                : "transition-transform duration-500 group-hover:scale-[1.03]"
            }`}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="min-w-0 break-words text-[17px] font-semibold leading-snug tracking-tight">
              {product.name}
            </h3>
            <span className="whitespace-nowrap text-xs text-muted" title="仅统计网站已付款订单">
              已售 <span className="tabular-nums">{product.sold_count.toLocaleString("zh-CN")}</span> 个
              {site.hotProductIds.includes(product.id) && (
                <svg
                  viewBox="0 0 24 24"
                  className="ml-1 inline-block h-4 w-4 align-[-3px] text-orange-500"
                  fill="currentColor"
                  role="img"
                  aria-label="热销"
                >
                  <title>热销</title>
                  <path d="M13.2 2C14 6.3 8 7.2 8 11c0 1.2.5 2.2 1.3 3C6.6 13.3 6 11.2 6.3 9.2 3.8 11.4 3 13.4 3 15.5a9 9 0 0 0 18 0C21 9.6 16.5 4.4 13.2 2Z" />
                  <path fill="#fcd34d" d="M12.5 12c.4 2.8-3.5 3.4-3.5 6a3 3 0 0 0 6 0c0-2.3-1.3-4.4-2.5-6Z" />
                </svg>
              )}
            </span>
          </div>
          {contactOnly ? (
            <Chip size="sm" variant="soft" color="accent" className="shrink-0">
              客服定制
            </Chip>
          ) : (
            <StockChip stock={product.stock} />
          )}
        </div>

        {product.description && (
          <p className="mt-2.5 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-muted">
            {product.description}
          </p>
        )}

        <div className="mt-5 flex flex-1 items-end justify-between gap-3">
          <Price
            cents={product.price_cents}
            className="flex items-baseline text-[26px] font-semibold leading-none tracking-tight"
            symbolClassName="mr-0.5 text-[17px] text-accent"
          />

          {contactOnly ? (
            <ContactBuyButton />
          ) : soldOut ? (
            <Button isDisabled variant="tertiary">
              暂时缺货
            </Button>
          ) : (
            <Link
              href={`/checkout/${product.id}`}
              className={buttonVariants({ variant: "primary" })}
            >
              立即购买
              <span className="cta-arrow font-mono" aria-hidden>
                →
              </span>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function StockChip({ stock }: { stock: number }) {
  if (stock < 1) {
    return (
      <Chip size="sm" variant="soft" color="default" className="shrink-0">
        售罄
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="soft" color="success" className="shrink-0 font-mono">
      库存 {stock}
    </Chip>
  );
}
