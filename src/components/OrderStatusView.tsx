"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Spinner } from "@heroui/react";
import type { OrderStatusPayload } from "@/lib/types";

type Props = {
  orderId: string;
  usageNotes?: string | null;
};

export function OrderStatusView({ orderId, usageNotes }: Props) {
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
          // 终态（已付/已过期）停止轮询
          if (payload.status === "paid" || payload.status === "expired") return;
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
    return (
      <Card className="p-6 text-sm text-muted">正在查询订单状态…</Card>
    );
  }

  if (data.status === "pending") {
    return (
      <Card className="p-6 text-sm text-muted">
        <span className="inline-flex items-center gap-2.5">
          <Spinner size="sm" color="current" />
          等待支付确认，完成后这里会自动显示卡密…
        </span>
      </Card>
    );
  }

  if (data.status === "expired") {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>订单已过期</Alert.Title>
          <Alert.Description>
            本单超过支付时限未完成支付，已自动取消、库存已释放。请重新下单。
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  if (data.stockOut || !data.secret) {
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>支付成功，但暂时缺货</Alert.Title>
          <Alert.Description>
            很抱歉，该商品库存不足，请保存本页链接并联系客服为你处理。
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <>
      <Card className="border-success/30 bg-success/5 p-6">
        <p className="text-sm font-semibold text-success">
          支付成功，卡密已发放
        </p>
        <div className="mt-4 flex items-center gap-3">
          <code className="flex-1 break-all rounded-lg border border-border bg-surface px-4 py-3 font-mono text-sm">
            {data.secret}
          </code>
          <Button
            variant="primary"
            className="shrink-0"
            onPress={() => handleCopy(data.secret as string)}
          >
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          请妥善保存卡密。建议截图本页，卡密仅发放一次。
        </p>
      </Card>

      <UsageGuide notes={usageNotes} />
    </>
  );
}

function UsageGuide({ notes }: { notes?: string | null }) {
  if (!notes || !notes.trim()) return null;
  return (
    <Card className="mt-5 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-separator bg-surface-secondary px-6 py-3.5">
        <BookIcon />
        <h2 className="text-sm font-semibold tracking-tight">使用教程</h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          how to use
        </span>
      </div>
      <div className="whitespace-pre-line px-6 py-5 text-sm leading-relaxed text-foreground/80">
        {notes}
      </div>
    </Card>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 text-accent"
      aria-hidden
    >
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5V5.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
