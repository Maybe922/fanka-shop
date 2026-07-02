import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Chip, buttonVariants } from "@heroui/react";
import { SiteHeader } from "@/components/SiteHeader";
import { getBuyer } from "@/lib/supabase/auth-server";
import { getMyOrders, expireStaleOrders } from "@/lib/data";
import { Price } from "@/components/Price";
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
          <Card
            variant="secondary"
            className="mt-8 border border-dashed border-border px-6 py-16 text-center shadow-none"
          >
            <p className="text-sm font-medium">还没有订单</p>
            <Link href="/" className="mt-3 inline-block text-sm text-accent">
              去首页挑选商品 →
            </Link>
          </Card>
        ) : (
          <ul className="mt-8 space-y-3">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}

        <Link
          href="/"
          className="mt-8 inline-block text-sm text-muted transition-colors hover:text-foreground"
        >
          ← 返回首页
        </Link>
      </div>
    </main>
  );
}

function StatusChip({ order }: { order: AdminOrder }) {
  if (order.status === "pending") {
    return (
      <Chip size="sm" variant="soft" color="warning">
        待支付
      </Chip>
    );
  }
  if (order.status === "expired") {
    return (
      <Chip size="sm" variant="soft" color="default">
        已过期
      </Chip>
    );
  }
  if (!order.card_id) {
    return (
      <Chip size="sm" variant="soft" color="danger">
        已付·缺货
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="soft" color="success">
      已支付
    </Chip>
  );
}

function OrderAction({ order }: { order: AdminOrder }) {
  if (order.status === "pending") {
    return (
      <Link
        href={`/order/${order.id}/pay`}
        className={`${buttonVariants({ variant: "primary", size: "sm" })} shrink-0`}
      >
        去支付
      </Link>
    );
  }
  if (order.status === "expired") {
    return (
      <Link
        href={`/checkout/${order.product_id}`}
        className={`${buttonVariants({ variant: "outline", size: "sm" })} shrink-0`}
      >
        重新下单
      </Link>
    );
  }
  return (
    <Link
      href={`/order/${order.id}`}
      className={`${buttonVariants({ variant: "secondary", size: "sm" })} shrink-0`}
    >
      查看卡密
    </Link>
  );
}

function OrderRow({ order }: { order: AdminOrder }) {
  return (
    <li>
      <Card className="flex flex-row items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="truncate text-sm font-semibold">
              {order.product_name ?? "—"}
            </span>
            <StatusChip order={order} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            <Price cents={order.amount_cents} />
            {" · "}
            {formatTime(order.created_at)}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted">
            订单号 {order.trade_order_id}
          </p>
        </div>
        <OrderAction order={order} />
      </Card>
    </li>
  );
}
