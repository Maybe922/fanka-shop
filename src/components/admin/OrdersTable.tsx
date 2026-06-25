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

function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

function OrderBadge({ order }: { order: AdminOrder }) {
  // 黄=待支付 / 绿=已支付 / 红=已过期
  if (order.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-amber-500">
        <Dot className="bg-amber-500" /> 待支付
      </span>
    );
  }
  if (order.status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
        <Dot className="bg-red-600" /> 已过期
      </span>
    );
  }
  if (!order.card_id) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
        <Dot className="bg-red-600" /> 已付·缺货
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-ok">
      <Dot className="bg-ok" /> 已支付
    </span>
  );
}
