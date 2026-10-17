"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { PaymentIcon } from "./PaymentIcon";
import { Price } from "./Price";
import { centsToYuanString } from "@/lib/money";
type PaymentMethod = "wechat" | "usdt_bep20" | "usdt_trc20";

// 结账确认页的「立即下单」按钮：调 /api/orders 创建订单并跳转自建收银台。
export function CheckoutOrderButton({ productId, priceCents, usdtAvailable = false, trc20Available = false, soldOut = false }: {
  productId: string; priceCents: number; usdtAvailable?: boolean; trc20Available?: boolean; soldOut?: boolean;
}) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUsdt = paymentMethod !== "wechat";
  const [rate, setRate] = useState<number | null>(null);
  const [rateError, setRateError] = useState(false);
  const [rateAttempt, setRateAttempt] = useState(0);

  useEffect(() => {
    if (!isUsdt) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const res = await fetch("/api/payments/usdt/rate", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error("Rate unavailable");
        const data = await res.json();
        const value = Number(data.rate);
        const age = Date.now() - Date.parse(data.fetchedAt);
        if (!Number.isFinite(value) || value < 1 || value > 100 || !Number.isFinite(age) || age < -30000 || age > 90000) throw new Error("Stale rate");
        if (active) { setRate(value); setRateError(false); }
      } catch {
        if (active) { setRate(null); setRateError(true); }
      }
      if (active) timer = setTimeout(refresh, 60000);
    }
    refresh();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [isUsdt, rateAttempt]);

  function choosePayment(method: PaymentMethod) {
    if (method !== "wechat" && paymentMethod === "wechat") { setRate(null); setRateError(false); }
    setPaymentMethod(method);
    setError(null);
  }

  async function placeOrder() {
    if (loading || soldOut) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 会话过期 → 引导重新登录
        if (res.status === 401) {
          router.push(`/login?next=/checkout/${productId}`);
          return;
        }
        setError(data.error ?? "下单失败，请重试");
        setLoading(false);
        return;
      }
      router.push(`/order/${data.orderId}/pay`);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mt-2 min-h-18" aria-live="polite" aria-atomic="true">
        {isUsdt ? <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-4xl font-semibold tracking-tight">{rate ? (priceCents / 100 / rate).toFixed(2) : "—"}</span>
            <span className="text-lg font-semibold">USDT</span>
            <span className="text-sm text-muted">/ 份</span>
            <span className="text-sm text-muted">≈ ¥{centsToYuanString(priceCents)}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            {rate ? "实时估算，准确付款金额以下单后收银台为准" : rateError ? <>汇率暂不可用，<button type="button" className="text-accent" onClick={() => { setRateError(false); setRateAttempt(n => n + 1); }}>点击重试</button></> : "正在获取实时汇率…"}
          </p>
        </> : <Price cents={priceCents} className="flex items-baseline text-4xl font-semibold tracking-tight" symbolClassName="mr-0.5 text-xl text-accent" />}
      </div>
      <fieldset disabled={loading} className="mb-6 mt-5">
        <legend className="mb-3 text-sm font-medium text-muted">支付方式</legend>
        <div className="flex rounded-[22px] bg-[#e8ede8] p-1.5 dark:bg-[#252d29]">
          {([
            { id: "wechat", title: "微信", subtitle: "" },
            ...(usdtAvailable ? [{ id: "usdt_bep20", title: "USDT", subtitle: "BEP20" }] : []),
            ...(trc20Available ? [{ id: "usdt_trc20", title: "USDT", subtitle: "TRC20" }] : []),
          ] as const).map(method => (
            <label key={method.id} className="min-w-0 flex-1 cursor-pointer">
              <input type="radio" name="payment-method" value={method.id}
                checked={paymentMethod === method.id} onChange={() => choosePayment(method.id as PaymentMethod)}
                className="peer sr-only" />
              <span className="flex min-h-18 items-center justify-center gap-2 rounded-[17px] border border-transparent px-1 py-3 transition-all peer-checked:border-[#d8e0d8] peer-checked:bg-white peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-disabled:cursor-wait dark:peer-checked:border-[#48534b] dark:peer-checked:bg-[#354139]">
                <PaymentIcon method={method.id as PaymentMethod} />
                <span className="min-w-0"><span className="block text-sm font-semibold leading-5">{method.title}</span>{method.subtitle && <span className="block text-xs leading-5 tracking-wide text-[#647168] dark:text-[#b7c6ba]">{method.subtitle}</span>}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 min-h-12 text-xs leading-6 text-muted" aria-live="polite">
          {paymentMethod === "wechat" ? "使用微信扫码付款，支付成功后自动发卡。" : `下单时按实时汇率换算，金额锁定 20 分钟；${paymentMethod === "usdt_trc20" ? "TRON（TRC20）" : "BEP20"} 链上确认到账后自动发卡。`}
        </p>
      </fieldset>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={placeOrder}
        isDisabled={loading || soldOut}
      >
        {soldOut ? "该商品暂时缺货" : loading ? "正在创建订单…" : "立即下单"}
        {!loading && !soldOut && (
          <span className="cta-arrow font-mono" aria-hidden>
            →
          </span>
        )}
      </Button>
      {error && (
        <p className="mt-2 text-center text-xs text-danger">{error}</p>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        下单后进入收银台，请在 20 分钟内完成支付
      </p>
    </div>
  );
}
