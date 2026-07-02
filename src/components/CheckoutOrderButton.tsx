"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

// 结账确认页的「立即下单」按钮：调 /api/orders 创建订单并跳转自建收银台。
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
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={placeOrder}
        isDisabled={loading}
      >
        {loading ? "正在跳转支付…" : "立即下单"}
        {!loading && (
          <span className="cta-arrow font-mono" aria-hidden>
            →
          </span>
        )}
      </Button>
      {error && (
        <p className="mt-2 text-center text-xs text-danger">{error}</p>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        下单后将跳转微信支付，请在 5 分钟内完成支付
      </p>
    </div>
  );
}
