import Link from "next/link";
import { Chip, Table, buttonVariants } from "@heroui/react";
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
      <Table.Root>
        <Table.ScrollContainer>
          <Table.Content aria-label="最近订单">
            <Table.Header>
              <Table.Column isRowHeader>订单号</Table.Column>
              <Table.Column>商品</Table.Column>
              <Table.Column>联系方式</Table.Column>
              <Table.Column>数量</Table.Column>
              <Table.Column>金额</Table.Column>
              <Table.Column>状态</Table.Column>
              <Table.Column>时间</Table.Column>
            </Table.Header>
            <Table.Body>
              {orders.map((o) => (
                <Table.Row key={o.id} id={o.id}>
                  <Table.Cell>
                    <span
                      className="whitespace-nowrap font-mono text-xs text-muted"
                      title={o.trade_order_id}
                    >
                      {shortId(o.trade_order_id)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{o.product_name ?? "—"}</Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-muted">
                      {o.contact ?? "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono">1</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Price cents={o.amount_cents} />
                  </Table.Cell>
                  <Table.Cell>
                    <OrderChip order={o} />
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-muted">
                      {formatTime(o.created_at)}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table.Root>

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
  const cls = buttonVariants({ variant: "outline", size: "sm" });
  if (disabled) {
    return (
      <span className={`${cls} pointer-events-none opacity-50`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={`/admin?page=${page}#orders`} className={cls}>
      {children}
    </Link>
  );
}

// 状态标签：绿=已发货，黄=待支付，红=缺货，灰=已过期。
function OrderChip({ order }: { order: AdminOrder }) {
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
      已发货
    </Chip>
  );
}
