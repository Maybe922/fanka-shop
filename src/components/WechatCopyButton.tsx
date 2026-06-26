"use client";

import { useState } from "react";

function WechatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M9 3C4.86 3 1.5 5.86 1.5 9.39c0 1.97 1.06 3.73 2.72 4.9l-.68 2.05 2.4-1.2c.86.24 1.78.37 2.73.37.2 0 .4 0 .6-.02a5.5 5.5 0 0 1-.27-1.7c0-3.2 3.04-5.79 6.78-5.79.25 0 .5.02.74.04C15.84 4.7 12.72 3 9 3Zm-2.7 4.2a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92Zm5.4 0a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92Z" />
      <path d="M22.5 13.64c0-2.94-2.86-5.32-6.39-5.32s-6.39 2.38-6.39 5.32 2.86 5.32 6.39 5.32c.78 0 1.53-.11 2.22-.31l1.96.98-.54-1.66c1.66-.97 2.75-2.5 2.75-4.33Zm-8.3-1.06a.78.78 0 1 1 0-1.56.78.78 0 0 1 0 1.56Zm3.82 0a.78.78 0 1 1 0-1.56.78.78 0 0 1 0 1.56Z" />
    </svg>
  );
}

/** 复制文本，兼容 HTTPS（Clipboard API）与不安全上下文（execCommand 兜底）。 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兜底
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type Props = {
  wechat: string;
  variant?: "chip" | "row";
};

/** 微信号「点击复制」标签。桌面用 chip，移动浮层用 row。 */
export function WechatCopyButton({ wechat, variant = "chip" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(wechat);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-sunken"
      >
        <WechatIcon className="h-4 w-4 text-ok" />
        <span className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Wechat · 点击复制
          </span>
          <span className="font-mono text-[13px] text-ink">
            {copied ? "已复制 ✓" : wechat}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="点击复制微信号"
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink transition-colors hover:border-accent hover:text-accent"
    >
      <WechatIcon className="h-3.5 w-3.5 text-ok" />
      {copied ? "已复制 ✓" : wechat}
    </button>
  );
}
