"use client";

import { useState } from "react";
import { updateArticle, deleteArticle } from "@/app/admin/actions";
import type { Article } from "@/lib/types";
import { fieldClass, labelClass } from "./form-styles";

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

export function AdminArticleCard({ article }: { article: Article }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <Chevron
            className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {article.title}
            </span>
            <span className="mt-1 block text-xs text-muted">
              {article.tag} · <span className="font-mono">/{article.slug}</span> ·{" "}
              {article.is_published ? (
                <span className="text-ok">已发布</span>
              ) : (
                <span className="text-warn">草稿</span>
              )}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {article.is_published && (
            <a
              href={`/guides/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-ink hover:text-ink"
            >
              查看 ↗
            </a>
          )}
          <form action={deleteArticle}>
            <input type="hidden" name="id" value={article.id} />
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-warn hover:text-warn"
            >
              删除
            </button>
          </form>
        </div>
      </div>

      {open && (
        <form action={updateArticle} className="mt-4 grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={article.id} />
          <label className="col-span-2">
            <span className={labelClass}>标题</span>
            <input
              name="title"
              defaultValue={article.title}
              required
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>分类标签</span>
            <input name="tag" defaultValue={article.tag} className={fieldClass} />
          </label>
          <label>
            <span className={labelClass}>URL 短码</span>
            <input
              name="slug"
              defaultValue={article.slug}
              className={`${fieldClass} font-mono`}
            />
          </label>
          <label className="col-span-2">
            <span className={labelClass}>摘要</span>
            <textarea
              name="summary"
              rows={2}
              defaultValue={article.summary}
              className={fieldClass}
            />
          </label>
          <label className="col-span-2">
            <span className={labelClass}>正文（Markdown）</span>
            <textarea
              name="content"
              rows={14}
              defaultValue={article.content}
              className={`${fieldClass} font-mono`}
            />
          </label>
          <label>
            <span className={labelClass}>排序</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={article.sort_order}
              className={fieldClass}
            />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={article.is_published}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            <span>已发布（前台可见）</span>
          </label>
          <button
            type="submit"
            className="col-span-2 rounded-lg bg-ink py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            保存修改
          </button>
        </form>
      )}
    </div>
  );
}
