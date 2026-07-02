"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile 无感人机验证。用官方脚本的「显式渲染」模式，
// 不引第三方包。脚本只在挂载本组件的页面（登录页）按需加载。

type TurnstileOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "auto" | "light" | "dark";
  language?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: TurnstileOptions) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// 全站只插一次脚本；并发挂载共用同一个 Promise。
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null; // 允许下次重试
      reject(new Error("Turnstile 脚本加载失败"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
};

export function TurnstileWidget({ siteKey, onVerify, onExpire, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // 用 ref 保存最新回调，避免回调变化导致 widget 重渲染（token 一次性，重渲染会丢）。
  const callbacks = useRef({ onVerify, onExpire, onError });
  useEffect(() => {
    callbacks.current = { onVerify, onExpire, onError };
  });

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => callbacks.current.onVerify(token),
          "expired-callback": () => callbacks.current.onExpire?.(),
          "error-callback": () => callbacks.current.onError?.(),
          theme: "auto",
          language: "zh-cn",
        });
      })
      .catch(() => callbacks.current.onError?.());

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // widget 可能已被移除，忽略
        }
      }
    };
  }, [siteKey]);

  return <div ref={ref} className="min-h-[65px]" />;
}
