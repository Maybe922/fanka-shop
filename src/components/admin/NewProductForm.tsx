import { createProduct } from "@/app/admin/actions";
import { fieldClass, labelClass } from "./form-styles";

export function NewProductForm() {
  return (
    <form
      action={createProduct}
      className="rounded-card border border-line bg-surface p-5"
    >
      <h3 className="text-sm font-semibold">新增商品</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelClass}>商品名称</span>
          <input name="name" required className={fieldClass} placeholder="例如：某某会员月卡" />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>商品简介</span>
          <textarea
            name="description"
            rows={3}
            className={fieldClass}
            placeholder="一句话描述，支持换行"
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>商品图片链接（可留空，填 http(s) 开头的图片网址）</span>
          <input
            name="imageUrl"
            type="url"
            className={fieldClass}
            placeholder="https://example.com/cover.png"
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>
            使用说明 / 教程（买家付款后在订单页看到，可留空）
          </span>
          <textarea
            name="usageNotes"
            rows={4}
            className={`${fieldClass} font-mono`}
            placeholder={"1. 前往充值站 https://...\n2. 输入卡密与 Token\n3. 一键充值到你的账号"}
          />
        </label>
        <label>
          <span className={labelClass}>价格（元）</span>
          <input
            name="priceYuan"
            type="number"
            step="0.01"
            min="0"
            required
            className={fieldClass}
            placeholder="9.90"
          />
        </label>
        <label>
          <span className={labelClass}>排序（小在前）</span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={0}
            className={fieldClass}
          />
        </label>
      </div>
      <button
        type="submit"
        className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        添加商品
      </button>
    </form>
  );
}
