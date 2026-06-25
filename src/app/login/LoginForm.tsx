"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestOtp, verifyOtp } from "./actions";

const field =
  "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent";

// 只允许站内相对路径，防开放重定向。
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await requestOtp(email);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPhase("code");
      setNotice(`验证码已发送至 ${email.trim()}，请查收（10 分钟内有效，注意垃圾箱）`);
    });
  }

  function verify() {
    setError(null);
    startTransition(async () => {
      const res = await verifyOtp(email, code);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-4">
      {notice && (
        <p className="rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          {error}
        </p>
      )}

      {phase === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted">邮箱</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`mt-1 ${field}`}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "发送中…" : "获取验证码"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="text-xs font-medium text-muted">
              6 位验证码（发送至 {email.trim()}）
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="______"
              className={`mt-1 text-center font-mono text-lg tracking-[0.5em] ${field}`}
            />
          </label>
          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "验证中…" : "登录"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPhase("email");
              setCode("");
              setError(null);
              setNotice(null);
            }}
            className="w-full text-sm text-muted transition-colors hover:text-ink"
          >
            ← 换个邮箱 / 重新获取
          </button>
        </form>
      )}
    </div>
  );
}
