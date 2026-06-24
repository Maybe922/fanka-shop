"use client";

import { useEffect, useState } from "react";
import type { OrderStatusPayload } from "@/lib/types";

type Props = {
  orderId: string;
};

export function OrderStatusView({ orderId }: Props) {
  const [data, setData] = useState<OrderStatusPayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (res.ok) {
          const payload = (await res.json()) as OrderStatusPayload;
          if (!active) return;
          setData(payload);
          if (payload.status === "paid") return; // delivered or stock-out: stop polling
        }
      } catch {
        // transient network error — keep polling
      }
      if (active) timer = setTimeout(poll, 2500);
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderId]);

  async function handleCopy(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (!data) {
    return <StatusShell>正在查询订单状态…</StatusShell>;
  }

  if (data.status === "pending") {
    return (
      <StatusShell>
        <span className="inline-flex items-center gap-2">
          <Spinner />
          等待支付确认，完成后这里会自动显示卡密…
        </span>
      </StatusShell>
    );
  }

  if (data.stockOut || !data.secret) {
    return (
      <div className="rounded-card border border-warn/30 bg-warn/5 p-6">
        <p className="text-sm font-semibold text-warn">支付成功，但暂时缺货</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          很抱歉，该商品库存不足，请保存本页链接并联系客服为你处理。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-ok/30 bg-ok/5 p-6">
      <p className="text-sm font-semibold text-ok">支付成功，卡密已发放</p>
      <div className="mt-4 flex items-center gap-3">
        <code className="flex-1 break-all rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm">
          {data.secret}
        </code>
        <button
          onClick={() => handleCopy(data.secret as string)}
          className="shrink-0 rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        请妥善保存卡密。建议截图本页，卡密仅发放一次。
      </p>
    </div>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-6 text-sm text-muted">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
  );
}
