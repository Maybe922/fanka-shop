import { updateProduct, deleteProduct } from "@/app/admin/actions";
import { centsToYuanString } from "@/lib/money";
import type { ProductWithStock, AdminCard } from "@/lib/types";
import { fieldClass, labelClass } from "./form-styles";
import { CardRow } from "./CardRow";
import { StockForm } from "./StockForm";

export function AdminProductCard({
  product,
  cards,
}: {
  product: ProductWithStock;
  cards: AdminCard[];
}) {
  // 已售卡密移到「最近订单」展示/换货，这里只管未售 + 占用中的可用库存。
  const manageable = cards.filter((c) => c.status !== "sold");

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{product.name}</h4>
          <p className="mt-1 text-xs text-muted">
            库存 <span className="font-medium text-ok">{product.stock}</span> · 已售{" "}
            {product.sold} ·{" "}
            {product.is_active ? (
              <span className="text-ok">已上架</span>
            ) : (
              <span className="text-warn">已下架</span>
            )}
          </p>
        </div>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={product.id} />
          <button
            type="submit"
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-warn hover:text-warn"
          >
            删除
          </button>
        </form>
      </div>

      {/* Edit */}
      <form action={updateProduct} className="mt-4 grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={product.id} />
        <label className="col-span-2">
          <span className={labelClass}>名称</span>
          <input name="name" defaultValue={product.name} required className={fieldClass} />
        </label>
        <label className="col-span-2">
          <span className={labelClass}>简介</span>
          <textarea
            name="description"
            rows={2}
            defaultValue={product.description ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="col-span-2">
          <span className={labelClass}>
            使用说明 / 教程（买家付款后在订单页看到，支持换行）
          </span>
          <textarea
            name="usageNotes"
            rows={5}
            defaultValue={product.usage_notes ?? ""}
            className={`${fieldClass} font-mono`}
            placeholder={
              "示例：\n1. 前往充值站 https://...\n2. 输入卡密与 Token\n3. 一键充值到你的账号\n\n如遇问题联系客服。"
            }
          />
        </label>
        <label>
          <span className={labelClass}>价格（元）</span>
          <input
            name="priceYuan"
            type="number"
            step="0.01"
            min="0"
            defaultValue={centsToYuanString(product.price_cents)}
            required
            className={fieldClass}
          />
        </label>
        <label>
          <span className={labelClass}>排序</span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={product.sort_order}
            className={fieldClass}
          />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={product.is_active}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span>上架（前台可见并可购买）</span>
        </label>
        <button
          type="submit"
          className="col-span-2 rounded-lg bg-ink py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          保存修改
        </button>
      </form>

      {/* 卡密管理：逐条查看 / 改内容 / 删除 */}
      <details className="mt-4 border-t border-line pt-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-ink">
          管理卡密
          <span className="ml-1 text-muted">（可用 {manageable.length} 张）</span>
        </summary>

        {manageable.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            暂无可用卡密，用下方「进货」添加。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {manageable.map((card) => (
              <CardRow key={card.id} card={card} />
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted">
          已售出的卡密在下方「最近订单」里查看；如出问题可在订单行直接改内容换货。
        </p>
      </details>

      {/* 进货卡密 */}
      <StockForm productId={product.id} />
    </div>
  );
}
