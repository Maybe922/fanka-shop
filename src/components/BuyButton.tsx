"use client";

import { useState } from "react";

export function BuyButton({
  productId,
  soldOut,
}: {
  productId: string;
  soldOut: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (soldOut) {
    return (
      <button
        disabled
        className="w-full cursor-not-allowed rounded-xl border border-line bg-bg py-2.5 text-sm font-medium text-muted"
      >
        无库存
      </button>
    );
  }

  async function handleBuy() {
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
        setError(data.error ?? "下单失败，请重试");
        setLoading(false);
        return;
      }
      window.location.href = data.payUrl;
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {loading ? "正在跳转支付…" : "立即购买"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-warn">{error}</p>}
    </div>
  );
}
