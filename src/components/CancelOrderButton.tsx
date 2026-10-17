"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const data = await response.json();
      if (response.ok || data.status === "paid" || data.status === "expired") {
        router.replace(`/order/${orderId}`);
        router.refresh();
        return;
      }
      setError(data.error || "取消失败，请稍后重试");
    } catch {
      setError("网络连接中断，请重试或查看订单状态");
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 border-t border-border pt-4 text-center">
      {confirming ? (
        <div className="rounded-xl bg-danger/5 p-4 text-left">
          <p className="text-sm font-medium">确定取消这笔订单？</p>
          <p className="mt-2 text-xs leading-6 text-muted">取消后将释放预留库存，请勿继续付款。如已扫码付款或发出转账，请保留订单并等待到账确认。</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={cancel} className="rounded-full bg-danger/10 px-4 py-2 text-xs font-medium text-danger disabled:opacity-50">{busy ? "正在取消…" : "尚未付款，确认取消"}</button>
            <button type="button" disabled={busy} onClick={() => { setConfirming(false); setError(""); }} className="rounded-full border border-border px-4 py-2 text-xs disabled:opacity-50">保留订单</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-sm text-danger transition-opacity hover:opacity-70">取消订单</button>
      )}
      {error && <p role="alert" className="mt-3 text-xs leading-6 text-danger">{error}</p>}
    </div>
  );
}
