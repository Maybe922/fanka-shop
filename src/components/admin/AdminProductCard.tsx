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
} from "@heroui/react";
import { updateProduct, deleteProduct } from "@/app/admin/actions";
import { centsToYuanString } from "@/lib/money";
import type { ProductWithStock, AdminCard } from "@/lib/types";
import { CardRow } from "./CardRow";
import { StockForm } from "./StockForm";

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

export function AdminProductCard({
  product,
  cards,
}: {
  product: ProductWithStock;
  cards: AdminCard[];
}) {
  // 默认收起：后台商品多时保持清爽，点头部展开编辑。
  const [open, setOpen] = useState(false);

  // 已售卡密移到「最近订单」展示/换货，这里只管未售 + 占用中的可用库存。
  const manageable = cards.filter((c) => c.status !== "sold");

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
          <span>
            <span className="block text-sm font-semibold">{product.name}</span>
            <span className="mt-1 block text-xs text-muted">
              库存{" "}
              <span className="font-medium text-success">{product.stock}</span>{" "}
              · 已售 {product.sold} ·{" "}
              {product.is_active ? (
                <span className="text-success">已上架</span>
              ) : (
                <span className="text-warning">已下架</span>
              )}
            </span>
          </span>
        </button>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={product.id} />
          <Button type="submit" variant="danger-soft" size="sm">
            删除
          </Button>
        </form>
      </div>

      {open && (
        <>
          {/* Edit */}
          <form action={updateProduct} className="mt-4 grid grid-cols-2 gap-4">
            <input type="hidden" name="id" value={product.id} />
            <TextField
              name="name"
              defaultValue={product.name}
              isRequired
              className="col-span-2"
            >
              <Label>名称</Label>
              <Input />
            </TextField>
            <TextField
              name="description"
              defaultValue={product.description ?? ""}
              className="col-span-2"
            >
              <Label>简介</Label>
              <TextArea rows={2} />
            </TextField>
            <TextField
              name="imageUrl"
              type="url"
              defaultValue={product.image_url ?? ""}
              className="col-span-2"
            >
              <Label>商品图片链接（http(s) 开头，可留空）</Label>
              <Input placeholder="https://example.com/cover.png" />
            </TextField>
            {product.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt="当前图片"
                className="col-span-2 h-20 w-auto rounded-lg border border-border object-cover"
              />
            )}
            <TextField
              name="usageNotes"
              defaultValue={product.usage_notes ?? ""}
              className="col-span-2"
            >
              <Label>使用说明 / 教程（买家付款后在订单页看到，支持换行）</Label>
              <TextArea
                rows={5}
                className="font-mono"
                placeholder={
                  "示例：\n1. 前往充值站 https://...\n2. 输入卡密与 Token\n3. 一键充值到你的账号\n\n如遇问题联系客服。"
                }
              />
            </TextField>
            <TextField
              name="priceYuan"
              type="number"
              defaultValue={centsToYuanString(product.price_cents)}
              isRequired
            >
              <Label>价格（元）</Label>
              <Input step="0.01" min="0" />
            </TextField>
            <TextField
              name="sortOrder"
              type="number"
              defaultValue={String(product.sort_order)}
            >
              <Label>排序</Label>
              <Input />
            </TextField>
            <Switch
              name="isActive"
              defaultSelected={product.is_active}
              className="col-span-2"
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <Label>上架（前台可见并可购买）</Label>
              </Switch.Content>
            </Switch>
            <Button type="submit" variant="primary" className="col-span-2">
              保存修改
            </Button>
          </form>

          {/* 卡密管理：逐条查看 / 改内容 / 删除 */}
          <details className="mt-5 border-t border-separator pt-4">
            <summary className="cursor-pointer select-none text-sm font-medium">
              管理卡密
              <span className="ml-1 text-muted">
                （可用 {manageable.length} 张）
              </span>
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
        </>
      )}
    </Card>
  );
}
