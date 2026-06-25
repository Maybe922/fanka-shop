import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getBuyer } from "@/lib/supabase/auth-server";
import { getMyOrders, expireStaleOrders } from "@/lib/data";
import { formatCny } from "@/lib/money";
import type { AdminOrder } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export default async function OrdersPage() {
  const buyer = await getBuyer();
  if (!buyer) redirect("/login?next=/orders");

  // 先回收超时订单，保证状态最新。
  await expireStaleOrders();
  const orders = await getMyOrders(buyer.id);

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">订单中心</h1>
        <p className="mt-1.5 text-sm text-muted">
          {buyer.email} 的全部订单，可继续支付、查看卡密或重新下单。
        </p>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
            <p className="text-sm font-medium">还没有订单</p>
            <Link href="/" className="mt-3 inline-block text-sm text-accent">
              去首页挑选商品 →
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}

        <Link
          href="/"
          className="mt-8 inline-block text-sm text-muted transition-colors hover:text-ink"
        >
          ← 返回首页
        </Link>
      </div>
    </main>
  );
}

function StatusBadge({ order }: { order: AdminOrder }) {
  if (order.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> 待支付
      </span>
    );
  }
  if (order.status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
        <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> 已过期
      </span>
    );
  }
  if (!order.card_id) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
        <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> 已付·缺货
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok">
      <span className="inline-block h-2 w-2 rounded-full bg-ok" /> 已支付
    </span>
  );
}

function OrderAction({ order }: { order: AdminOrder }) {
  const cls =
    "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  if (order.status === "pending") {
    return (
      <Link
        href={`/order/${order.id}/pay`}
        className={`${cls} bg-ink text-white hover:opacity-90`}
      >
        去支付
      </Link>
    );
  }
  if (order.status === "expired") {
    return (
      <Link
        href={`/checkout/${order.product_id}`}
        className={`${cls} border border-line text-muted hover:border-accent hover:text-accent`}
      >
        重新下单
      </Link>
    );
  }
  return (
    <Link
      href={`/order/${order.id}`}
      className={`${cls} border border-accent text-accent hover:bg-accent hover:text-white`}
    >
      查看卡密
    </Link>
  );
}

function OrderRow({ order }: { order: AdminOrder }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="truncate text-sm font-semibold">
            {order.product_name ?? "—"}
          </span>
          <StatusBadge order={order} />
        </div>
        <p className="mt-1 text-xs text-muted">
          <span className="font-mono">{formatCny(order.amount_cents)}</span>
          {" · "}
          {formatTime(order.created_at)}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-muted">
          订单号 {order.trade_order_id}
        </p>
      </div>
      <OrderAction order={order} />
    </li>
  );
}
