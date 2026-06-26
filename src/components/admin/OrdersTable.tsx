import Link from "next/link";
import { Price } from "@/components/Price";
import type { AdminOrder } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

// 订单号展示用短号（取我方订单号尾段，过长时截断）。
function shortId(tradeOrderId: string): string {
  const tail = tradeOrderId.split("-").pop() ?? tradeOrderId;
  return tail.length > 10 ? tail.slice(-10) : tail;
}

type Props = {
  orders: AdminOrder[];
  page: number;
  pageSize: number;
  total: number;
};

export function OrdersTable({ orders, page, pageSize, total }: Props) {
  if (total === 0) {
    return <p className="text-sm text-muted">暂无订单。</p>;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">订单号</th>
              <th className="px-4 py-3 font-medium">商品</th>
              <th className="px-4 py-3 font-medium">联系方式</th>
              <th className="px-4 py-3 font-medium">数量</th>
              <th className="px-4 py-3 font-medium">金额</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id}>
                <td
                  className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted"
                  title={o.trade_order_id}
                >
                  {shortId(o.trade_order_id)}
                </td>
                <td className="px-4 py-3">{o.product_name ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {o.contact ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono">1</td>
                <td className="px-4 py-3">
                  <Price cents={o.amount_cents} />
                </td>
                <td className="px-4 py-3">
                  <OrderBadge order={o} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {formatTime(o.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            第 {page} / {totalPages} 页 · 共 {total} 单
          </span>
          <div className="flex items-center gap-2">
            <PageLink page={page - 1} disabled={page <= 1}>
              ← 上一页
            </PageLink>
            <PageLink page={page + 1} disabled={page >= totalPages}>
              下一页 →
            </PageLink>
          </div>
        </div>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base =
    "rounded-lg border px-3 py-1.5 transition-colors";
  if (disabled) {
    return (
      <span className={`${base} border-line/60 text-muted/50`}>{children}</span>
    );
  }
  return (
    <Link
      href={`/admin?page=${page}#orders`}
      className={`${base} border-line text-ink hover:border-accent hover:text-accent`}
    >
      {children}
    </Link>
  );
}

// 状态药丸：绿底=已发货，描边=待支付/已过期/缺货。
function OrderBadge({ order }: { order: AdminOrder }) {
  const pill =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

  if (order.status === "pending") {
    return (
      <span className={`${pill} border border-amber-300 text-amber-600`}>
        待支付
      </span>
    );
  }
  if (order.status === "expired") {
    return (
      <span className={`${pill} border border-line text-muted`}>已过期</span>
    );
  }
  if (!order.card_id) {
    return (
      <span className={`${pill} border border-red-300 text-red-600`}>
        已付·缺货
      </span>
    );
  }
  return (
    <span className={`${pill} bg-ok/10 text-ok`}>已发货</span>
  );
}
