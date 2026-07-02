"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Spinner, buttonVariants } from "@heroui/react";
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
    <Card className="p-8 text-center">
      {qrDataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="微信支付二维码"
            width={240}
            height={240}
            className="mx-auto h-60 w-60 rounded-xl border border-border"
          />
          <p className="mt-4 text-sm">
            请用<b>微信</b>扫一扫上方二维码完成支付
          </p>
          {expiresAt && (
            <p className="mt-2 text-sm text-muted">
              二维码剩余有效时间{" "}
              <span className="font-mono font-semibold text-danger">
                {fmt(expireMs - now)}
              </span>
            </p>
          )}
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner size="sm" color="current" />
            {paid ? "支付成功，正在跳转…" : "等待支付，完成后自动跳转卡密页…"}
          </p>
        </>
      ) : (
        <p className="text-sm text-warning">支付码生成失败，请返回重新下单。</p>
      )}
    </Card>
  );
}
