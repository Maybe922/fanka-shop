"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Spinner, buttonVariants } from "@heroui/react";
import type { OrderStatusPayload } from "@/lib/types";
import { CancelOrderButton } from "./CancelOrderButton";
import { PaymentIcon } from "./PaymentIcon";

function PaymentDetailIcon({ kind }: { kind: "clock" | "scan" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      {kind === "clock" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h18" /></>}
    </svg>
  );
}

type Props = {
  orderId: string;
  productId: string;
  qrDataUrl: string | null;
  expiresAt: string | null; // ISO
  initialExpired: boolean;
};

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function PayPanel({
  orderId,
  productId,
  qrDataUrl,
  expiresAt,
  initialExpired,
}: Props) {
  const router = useRouter();
  const expireMs = expiresAt ? new Date(expiresAt).getTime() : 0;

  const [now, setNow] = useState<number>(() => Date.now());
  const [serverExpired, setServerExpired] = useState(initialExpired);
  const [paid, setPaid] = useState(false);

  // 本地时间到点即视为过期（派生值）；DB 侧由轮询/服务端清理收口。
  const expired = serverExpired || (expireMs > 0 && now >= expireMs);

  // 1 秒一跳的倒计时
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 轮询订单状态：已付跳卡密页；已过期标记过期
  useEffect(() => {
    if (paid) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (res.ok) {
          const p = (await res.json()) as OrderStatusPayload;
          if (!active) return;
          if (p.cancelledAt && p.status !== "paid") {
            router.replace(`/order/${orderId}`);
            return;
          }
          if (p.status === "paid") {
            setPaid(true);
            router.replace(`/order/${orderId}`);
            return;
          }
          if (p.status === "expired") setServerExpired(true);
        }
      } catch {
        // 瞬时错误，继续
      }
      if (active && !paid) timer = setTimeout(poll, 2500);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderId, router, paid]);

  if (expired) {
    return (
      <Card className="border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-base font-semibold text-danger">二维码已过期</p>
        <p className="mt-1.5 text-sm text-muted">
          本单超过 20 分钟未支付，库存已释放。请重新下单。
        </p>
        <div className="mt-5">
          <Link
            href={`/checkout/${productId}`}
            className={buttonVariants({ variant: "primary" })}
          >
            重新下单
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <PaymentIcon method="wechat" />
            <span className="font-semibold">微信支付</span>
          </div>
          <span className="rounded-full bg-[#07b657]/10 px-3 py-1.5 text-xs font-medium text-[#168447] dark:text-green-300">扫码付款</span>
        </div>
        {qrDataUrl && expiresAt && (
          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted">
            <span>请在有效期内完成支付</span>
            <span className={`flex shrink-0 items-center gap-1.5 font-mono tabular-nums ${expireMs - now < 60000 ? "text-danger" : ""}`}>
              <PaymentDetailIcon kind="clock" />剩余 {fmt(expireMs - now)}
            </span>
          </div>
        )}
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        {qrDataUrl ? (
          <>
            <div className="mx-auto mt-6 w-fit max-w-full rounded-2xl border border-[#07b657]/15 bg-[#07b657]/5 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="微信支付二维码"
                width={240}
                height={240}
                className="h-auto w-60 max-w-full rounded-lg bg-white p-2"
              />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-sm font-medium">
              <span className="text-[#168447] dark:text-green-300"><PaymentDetailIcon kind="scan" /></span>
              打开微信 · 扫一扫
            </div>
            <p className="mt-2 text-center text-xs leading-6 text-muted">扫描上方二维码，确认金额后完成支付</p>
            <div role="status" aria-live="polite" className="mt-5 rounded-2xl border border-[#07b657]/15 bg-[#07b657]/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#168447] dark:text-green-300">
                <Spinner size="sm" color="current" />
                <span>{paid ? "支付成功，正在跳转…" : "付款后请耐心等待"}</span>
              </div>
              <p className="mt-2 text-xs leading-6 text-muted">支付确认后自动发卡，页面会自动跳转，无需刷新或重复付款。</p>
            </div>
            <Link href={`/order/${orderId}`} className="mt-4 block text-center text-sm text-accent">查看订单 →</Link>
          </>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-warning">支付码生成失败，请返回重新下单。</p>
            <Link href={`/checkout/${productId}`} className="mt-4 inline-block text-sm text-accent">返回下单 →</Link>
          </div>
        )}
        {!paid && <CancelOrderButton orderId={orderId} />}
      </div>
    </Card>
  );
}
