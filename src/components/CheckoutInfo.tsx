import { PurchaseDemo } from "@/components/purchase-demo/PurchaseDemo";

export function CheckoutInfo({ contactOnly = false, usdtAvailable = false, trc20Available = false }: { contactOnly?: boolean; usdtAvailable?: boolean; trc20Available?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border py-4 text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-accent">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          30 天订阅质保
        </span>
        <span className="text-muted">{contactOnly ? "人工客服交付" : "付款后自动发卡"}</span>
        <span className="text-muted">不支持开具发票</span>
      </div>

      <div className="space-y-4 py-5">
        <section aria-labelledby="purchase-notes" className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[4rem_1fr] sm:gap-5">
          <h2 id="purchase-notes" className="text-sm font-medium text-muted">购买须知</h2>
          <div className="space-y-3 text-sm leading-7">
            {contactOnly ? (
              <p>请先联系客服确认套餐、充值方式和交付安排，再完成购买。</p>
            ) : (
              <>
                <p>{(usdtAvailable || trc20Available) ? "支持微信扫码与 USDT 支付。" : "支持微信扫码支付。"}确认到账后自动发卡，可在订单详情页查看卡密与使用说明。</p>
                <p><strong className="font-semibold">卡密一经发出不支持退款。</strong>请在下单前确认商品与充值方式。</p>
                <p className="text-muted">订单与卡密绑定下单时的登录邮箱，请确认邮箱正确。后续可使用同一邮箱登录，在「我的订单」中找回。</p>
              </>
            )}
            <p className="text-muted">下单前请确认商品和充值方式；有疑问可通过右上角「客服」咨询。</p>
          </div>
        </section>

        <section aria-labelledby="after-sales" className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[4rem_1fr] sm:gap-5">
          <h2 id="after-sales" className="text-sm font-medium text-muted">售后保障</h2>
          <div className="space-y-3 text-sm leading-7">
            <p>
              <mark className="relative isolate whitespace-nowrap bg-transparent font-semibold text-inherit">
                <span
                  aria-hidden="true"
                  className="absolute -inset-x-1 bottom-0 -z-10 h-[80%] -rotate-1 bg-amber-200/75 dark:bg-amber-400/30"
                  style={{ clipPath: "polygon(0 16%, 98% 0, 100% 84%, 2% 100%)" }}
                />
                仅保障订阅 · 30 天
              </mark>
              。质保期内如遇订阅异常，请保留订单号并联系客服处理。
            </p>
            <p><strong className="font-semibold">账号封禁不在质保范围内，不提供售后。</strong>包括网络 IP 异常、多人共享等情况下的账号封禁，请自行妥善管理账号及使用环境。</p>
            <p className="text-muted">不支持开具发票，请在下单前确认可以接受。</p>
          </div>
        </section>
      </div>

      <div className="rounded-2xl bg-surface-secondary/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-medium text-muted">{contactOnly ? "购买流程" : "三步完成购买"}</h2>
          {!contactOnly && <PurchaseDemo compact />}
        </div>
        <ol className="grid grid-cols-3 gap-3">
          {(contactOnly
            ? ["联系客服", "确认套餐", "安排交付"]
            : [(usdtAvailable || trc20Available) ? "选择方式付款" : "微信扫码付款", "订单页取卡密", "按指引充值"]
          ).map((step, index) => (
            <li key={step} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-background font-mono text-xs text-accent">{index + 1}</span>
              <span className="text-xs font-medium leading-5 sm:text-[13px]">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
