import { updateProduct, deleteProduct, addCards } from "@/app/admin/actions";
import { centsToYuanString } from "@/lib/money";
import type { ProductWithStock } from "@/lib/types";
import { fieldClass, labelClass } from "./form-styles";

export function AdminProductCard({ product }: { product: ProductWithStock }) {
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

      {/* 进货卡密 */}
      <form action={addCards} className="mt-4 border-t border-line pt-4">
        <input type="hidden" name="productId" value={product.id} />
        <span className={labelClass}>进货卡密（每行一个）</span>
        <textarea
          name="secrets"
          rows={3}
          required
          className={`${fieldClass} font-mono`}
          placeholder={"CARD-AAAA-1111\nCARD-BBBB-2222"}
        />
        <button
          type="submit"
          className="mt-2 rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white"
        >
          进货
        </button>
      </form>
    </div>
  );
}
