"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Spinner } from "@heroui/react";
import type { OrderStatusPayload } from "@/lib/types";
import { CancelOrderButton } from "./CancelOrderButton";
import { PaymentIcon } from "./PaymentIcon";

function DetailIcon({ kind }: { kind: "copy" | "clock" | "shield" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
    {kind === "copy" ? <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></> : kind === "clock" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>}
  </svg>;
}

type Props = {
  network: "BEP20" | "TRC20"; orderId: string; address: string; amount: string; rate: string;
  qrDataUrl: string; expiresAt: string; initialReview: boolean;
};
export function UsdtPayPanel({ network, orderId, address, amount, rate, qrDataUrl, expiresAt, initialReview }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [review, setReview] = useState(initialReview);
  const [copyStatus, setCopyStatus] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const remaining = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
  const expired = remaining === 0;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          if (active) setAuthRequired(true);
          return;
        }
        if (!res.ok) throw new Error("Unavailable");
        const data: OrderStatusPayload = await res.json();
        if (!active) return;
        setConnectionError(false);
        if (data.cancelledAt && data.status !== "paid") { router.replace(`/order/${orderId}`); return; }
        if (data.status === "paid") { router.replace(`/order/${orderId}`); return; }
        if (data.paymentState === "review") setReview(true);
      } catch { if (active) setConnectionError(true); }
      if (active) timer = setTimeout(poll, 5000);
    }
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [orderId, router]);
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyStatus(`${label}已复制`); }
    catch { setCopyStatus("复制失败，请长按或选中文字复制"); }
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3"><PaymentIcon method={network === "TRC20" ? "usdt_trc20" : "usdt_bep20"} /><span className="font-semibold">USDT 支付</span></div>
        <span className="rounded-full bg-[#269c85]/10 px-3 py-1.5 text-xs font-medium text-[#207f6d] dark:text-emerald-300">{network === "TRC20" ? "TRC20 · TRON" : "BEP20 · BSC"}</span>
      </div>
      {!expired && <div className="mt-4 flex items-center justify-between text-xs text-muted"><span>请在有效期内完成转账</span><span className="flex items-center gap-1.5 font-mono"><DetailIcon kind="clock" />剩余 {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</span></div>}
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
      {review || expired ? (
        <div className="mt-6 rounded-2xl border border-border p-5 text-sm leading-7">
          <h2 className="font-semibold">{review ? "付款已记录，需联系客服处理" : "付款时间已结束，请勿继续转账"}</h2>
          <p className="mt-2 text-muted">{review ? "这笔转账超过了订单付款时间，请提供订单号及交易哈希给客服。" : "如已在有效期内转账，请等待链上核验，勿重复支付。转账延迟、金额不符等问题请保留交易哈希联系客服。"}</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-center text-xs text-muted">本单应到账金额</p>
          <div className="mt-1 text-center"><strong className="font-mono text-3xl tracking-tight">{amount}</strong><span className="ml-2 text-sm">USDT</span></div>
          <button type="button" className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-accent/5 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10" onClick={() => copy(amount, "金额")}><DetailIcon kind="copy" />复制精确金额</button>
          <p className="mt-2 text-center text-xs leading-5 text-muted">1 USDT ≈ ¥{rate} · 本单汇率已锁定</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`${network} 收款地址二维码`} width={220} height={220} className="mx-auto mt-5 h-55 w-55 rounded-xl bg-white p-2" />
          <div className="mt-5 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-1.5 text-muted"><DetailIcon kind="shield" />{network} 收款地址</span><button type="button" className="flex shrink-0 items-center gap-1 rounded-full bg-accent/5 px-2.5 py-1.5 text-accent" onClick={() => copy(address, "地址")}><DetailIcon kind="copy" />复制</button></div>
            <p className="mt-2 break-all font-mono text-xs leading-6">{address}</p>
          </div>
          <p className="mt-2 text-center text-xs text-muted">扫码仅获取地址，请手动填写完整金额</p>
          <p className="mt-4 text-xs leading-6 text-muted">请按完整金额转账，保留全部 6 位小数。金额含不足 0.01 USDT 的订单识别尾数。请确保扣除手续费后的实际到账金额一致。</p>
          <p className="mt-2 text-xs leading-6 text-muted">仅支持 {network === "TRC20" ? "TRON（TRC20）" : "BEP20"} 链上转账，不支持币安内部转账或其他网络。金额不符或超时到账请联系客服处理。</p>
        </>
      )}
      <p role="status" className="mt-3 text-center text-xs text-accent">{copyStatus}</p>
      {!review && <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-[#269c85]/15 bg-[#269c85]/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[#207f6d] dark:text-emerald-300">
          {authRequired ? <DetailIcon kind="shield" /> : <Spinner size="sm" color="current" />}
          <span>{authRequired ? "请登录后查看到账结果" : connectionError ? "连接暂时中断，正在重试" : expired ? "已转账？请耐心等待核验" : "转账后请耐心等待"}</span>
        </div>
        <p className="mt-2 text-xs leading-6 text-muted">{authRequired ? "登录状态已失效。后台会继续核验到账，请勿重复付款。" : connectionError ? "后台会继续核验到账，连接恢复后页面会自动更新。请勿重复付款。" : expired ? "如已在有效期内转账，系统会继续核验。请勿重复付款，异常情况请联系客服。" : "链上确认到账后自动发卡，页面会自动更新，无需刷新或重复付款。"}</p>
        {authRequired && <Link href={`/login?next=${encodeURIComponent(`/order/${orderId}`)}`} className="mt-2 inline-block text-xs font-medium text-accent">重新登录查看订单 →</Link>}
      </div>}
      <Link href={`/order/${orderId}`} className="mt-4 block text-center text-sm text-accent">查看订单 →</Link>
      {!review && !expired && !authRequired && <CancelOrderButton orderId={orderId} />}
      </div>
    </Card>
  );
}
