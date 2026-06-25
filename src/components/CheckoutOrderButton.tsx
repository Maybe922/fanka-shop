"use client";

import { useState } from "react";

// 结账确认页的「立即下单」按钮：调 /api/orders 创建订单并跳转虎皮椒收银台。
export function CheckoutOrderButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function placeOrder() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 会话过期 → 引导重新登录
        if (res.status === 401) {
          window.location.href = `/login?next=/checkout/${productId}`;
          return;
        }
        setError(data.error ?? "下单失败，请重试");
        setLoading(false);
        return;
      }
      window.location.href = `/order/${data.orderId}/pay`;
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={placeOrder}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "正在跳转支付…" : "立即下单"}
        {!loading && <span aria-hidden>→</span>}
      </button>
      {error && <p className="mt-2 text-center text-xs text-warn">{error}</p>}
      <p className="mt-3 text-center text-xs text-muted">
        下单后将跳转微信支付，请在 5 分钟内完成支付
      </p>
    </div>
  );
}
