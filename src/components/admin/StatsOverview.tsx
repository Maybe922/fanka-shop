import { Price } from "@/components/Price";

type Props = {
  stockLeft: number;
  soldOrders: number;
  revenueCents: number;
};

const cardClass = "rounded-card border border-line bg-surface px-5 py-4";
const labelClass =
  "font-mono text-[11px] uppercase tracking-[0.12em] text-muted";
const valueClass = "mt-2 font-mono text-2xl font-bold tracking-tight";

/** 后台顶部「节点概览」：库存剩余 / 售出订单 / 销售额。 */
export function StatsOverview({ stockLeft, soldOrders, revenueCents }: Props) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold tracking-tight">节点概览</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cardClass}>
          <p className={labelClass}>库存剩余</p>
          <p className={`${valueClass} text-ink`}>{stockLeft}</p>
        </div>
        <div className={cardClass}>
          <p className={labelClass}>售出订单</p>
          <p className={`${valueClass} text-ink`}>{soldOrders}</p>
        </div>
        <div className={cardClass}>
          <p className={labelClass}>销售额</p>
          <Price cents={revenueCents} className={`${valueClass} block text-ok`} />
        </div>
      </div>
    </section>
  );
}
