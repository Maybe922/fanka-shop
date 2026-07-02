"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Switch,
  TextArea,
  TextField,
  buttonVariants,
} from "@heroui/react";
import { updateArticle, deleteArticle } from "@/app/admin/actions";
import type { Article } from "@/lib/types";

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
    <Card className="p-5">
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
              {article.tag} ·{" "}
              {article.is_published ? (
                <span className="text-success">已发布</span>
              ) : (
                <span className="text-warning">草稿</span>
              )}
              {!article.link_url && (
                <span className="text-warning"> · 未填链接</span>
              )}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {article.link_url && (
            <a
              href={article.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              查看 ↗
            </a>
          )}
          <form action={deleteArticle}>
            <input type="hidden" name="id" value={article.id} />
            <Button type="submit" variant="danger-soft" size="sm">
              删除
            </Button>
          </form>
        </div>
      </div>

      {open && (
        <form action={updateArticle} className="mt-4 grid grid-cols-2 gap-4">
          <input type="hidden" name="id" value={article.id} />
          <TextField
            name="title"
            defaultValue={article.title}
            isRequired
            className="col-span-2"
          >
            <Label>标题</Label>
            <Input />
          </TextField>
          <TextField
            name="linkUrl"
            type="url"
            defaultValue={article.link_url}
            isRequired
            className="col-span-2"
          >
            <Label>教程链接（飞书 / 文档外链）</Label>
            <Input
              className="font-mono"
              placeholder="https://xxx.feishu.cn/docx/..."
            />
          </TextField>
          <TextField name="tag" defaultValue={article.tag}>
            <Label>分类标签</Label>
            <Input />
          </TextField>
          <TextField
            name="sortOrder"
            type="number"
            defaultValue={String(article.sort_order)}
          >
            <Label>排序</Label>
            <Input />
          </TextField>
          <TextField
            name="summary"
            defaultValue={article.summary}
            className="col-span-2"
          >
            <Label>摘要</Label>
            <TextArea rows={2} />
          </TextField>
          <Switch
            name="isPublished"
            defaultSelected={article.is_published}
            className="col-span-2"
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>已发布（前台可见）</Label>
            </Switch.Content>
          </Switch>
          <Button type="submit" variant="primary" className="col-span-2">
            保存修改
          </Button>
        </form>
      )}
    </Card>
  );
}
