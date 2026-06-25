"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatusPayload } from "@/lib/types";

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
  const [expired, setExpired] = useState(initialExpired);
  const [paid, setPaid] = useState(false);

  // 1 秒一跳的倒计时
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 时间到 → 本地标记过期（DB 侧由轮询/服务端清理收口）
  useEffect(() => {
    if (expireMs && now >= expireMs) setExpired(true);
  }, [now, expireMs]);

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
          if (p.status === "paid") {
            setPaid(true);
            router.replace(`/order/${orderId}`);
            return;
          }
          if (p.status === "expired") setExpired(true);
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
      <div className="rounded-card border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-base font-semibold text-red-600">
          二维码已过期
        </p>
        <p className="mt-1.5 text-sm text-muted">
          本单超过 20 分钟未支付，库存已释放。请重新下单。
        </p>
        <Link
          href={`/checkout/${productId}`}
          className="mt-5 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          重新下单
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-8 text-center">
      {qrDataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="微信支付二维码"
            width={240}
            height={240}
            className="mx-auto h-60 w-60 rounded-xl border border-line"
          />
          <p className="mt-4 text-sm text-ink">
            请用<b>微信</b>扫一扫上方二维码完成支付
          </p>
          {expiresAt && (
            <p className="mt-2 text-sm text-muted">
              二维码剩余有效时间{" "}
              <span className="font-mono font-semibold text-red-600">
                {fmt(expireMs - now)}
              </span>
            </p>
          )}
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
            {paid ? "支付成功，正在跳转…" : "等待支付，完成后自动跳转卡密页…"}
          </p>
        </>
      ) : (
        <p className="text-sm text-warn">支付码生成失败，请返回重新下单。</p>
      )}
    </div>
  );
}
