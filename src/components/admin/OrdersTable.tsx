import { formatCny } from "@/lib/money";
import type { AdminOrder } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-muted">暂无订单。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">时间</th>
            <th className="px-4 py-3 font-medium">商品</th>
            <th className="px-4 py-3 font-medium">金额</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">订单号</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {formatTime(o.created_at)}
              </td>
              <td className="px-4 py-3">{o.product_name ?? "—"}</td>
              <td className="px-4 py-3 font-mono">{formatCny(o.amount_cents)}</td>
              <td className="px-4 py-3">
                <OrderBadge order={o} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted">
                {o.trade_order_id}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderBadge({ order }: { order: AdminOrder }) {
  if (order.status === "pending") {
    return <span className="text-muted">待支付</span>;
  }
  if (!order.card_id) {
    return <span className="font-medium text-warn">已付·缺货</span>;
  }
  return <span className="font-medium text-ok">已发卡</span>;
}
