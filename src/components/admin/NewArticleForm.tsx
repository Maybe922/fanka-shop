import { createArticle } from "@/app/admin/actions";
import { fieldClass, labelClass } from "./form-styles";

export function NewArticleForm() {
  return (
    <form
      action={createArticle}
      className="rounded-card border border-line bg-surface p-5"
    >
      <h3 className="text-sm font-semibold">写新文章</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelClass}>标题</span>
          <input
            name="title"
            required
            className={fieldClass}
            placeholder="例如：ChatGPT Plus 卡密充值图文教程"
          />
        </label>
        <label>
          <span className={labelClass}>分类标签（卡片上显示）</span>
          <input
            name="tag"
            className={fieldClass}
            defaultValue="充值教程"
            placeholder="充值教程 / 常见问题"
          />
        </label>
        <label>
          <span className={labelClass}>URL 短码（留空自动生成）</span>
          <input
            name="slug"
            className={`${fieldClass} font-mono`}
            placeholder="chatgpt-plus-recharge"
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>摘要（卡片上的简短说明）</span>
          <textarea
            name="summary"
            rows={2}
            className={fieldClass}
            placeholder="一句话概括这篇教程讲什么"
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>正文（Markdown：# 标题、**加粗**、- 列表、![图](链接)）</span>
          <textarea
            name="content"
            rows={12}
            className={`${fieldClass} font-mono`}
            placeholder={
              "## 第一步\n打开充值站 https://...\n\n![充值页面截图](https://example.com/step1.png)\n\n## 第二步\n输入卡密，点击充值。"
            }
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
        <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-1">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span>立即发布（前台可见）</span>
        </label>
      </div>
      <button
        type="submit"
        className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        发布文章
      </button>
    </form>
  );
}
