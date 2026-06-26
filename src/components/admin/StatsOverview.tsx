import { centsToYuanString } from "@/lib/money";

type Props = {
  stockLeft: number;
  soldOrders: number;
  revenueCents: number;
};

/** 后台顶部「节点概览」：库存剩余 / 售出订单 / 销售额。 */
export function StatsOverview({ stockLeft, soldOrders, revenueCents }: Props) {
  const items = [
    { label: "库存剩余", value: String(stockLeft), accent: false },
    { label: "售出订单", value: String(soldOrders), accent: false },
    { label: "销售额", value: `¥${centsToYuanString(revenueCents)}`, accent: true },
  ];

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold tracking-tight">节点概览</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-card border border-line bg-surface px-5 py-4"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              {item.label}
            </p>
            <p
              className={`mt-2 font-mono text-2xl font-bold tracking-tight ${
                item.accent ? "text-ok" : "text-ink"
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
