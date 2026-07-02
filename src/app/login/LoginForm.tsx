"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Input,
  InputOTP,
  Label,
  REGEXP_ONLY_DIGITS,
  TextField,
} from "@heroui/react";
import { requestOtp, verifyOtp } from "./actions";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { publicEnv } from "@/lib/env";

const OTP_LENGTH = 6;

// 只允许站内相对路径，防开放重定向。
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const siteKey = publicEnv.turnstileSiteKey;

  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 人机验证：token 一次性；失败后 bump nonce 强制重挂 widget 拿新 token。
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  // 配了 site key 才要求人机验证；没配则不挡。
  const captchaRequired = Boolean(siteKey);
  const captchaReady = !captchaRequired || Boolean(captchaToken);

  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaNonce((n) => n + 1);
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await requestOtp(email, captchaToken ?? "");
      if (!res.ok) {
        setError(res.error);
        resetCaptcha(); // token 已被消费，刷新人机验证
        return;
      }
      setPhase("code");
      setNotice(
        `验证码已发送至 ${email.trim()}，请查收（10 分钟内有效，注意垃圾箱）`,
      );
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
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{notice}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {phase === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="space-y-5"
        >
          <TextField
            type="email"
            value={email}
            onChange={setEmail}
            isRequired
            inputMode="email"
            autoComplete="email"
          >
            <Label>邮箱</Label>
            <Input placeholder="you@example.com" />
          </TextField>

          {captchaRequired && (
            <TurnstileWidget
              key={captchaNonce}
              siteKey={siteKey}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isDisabled={pending || !captchaReady}
          >
            {pending ? "发送中…" : "获取验证码"}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label>6 位验证码（发送至 {email.trim()}）</Label>
            <InputOTP
              maxLength={OTP_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              value={code}
              onChange={setCode}
              autoFocus
            >
              <InputOTP.Group>
                {Array.from({ length: OTP_LENGTH }, (_, i) => (
                  <InputOTP.Slot key={i} index={i} />
                ))}
              </InputOTP.Group>
            </InputOTP>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isDisabled={pending || code.length !== OTP_LENGTH}
          >
            {pending ? "验证中…" : "登录"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            isDisabled={pending}
            onPress={() => {
              setPhase("email");
              setCode("");
              setError(null);
              setNotice(null);
              resetCaptcha();
            }}
          >
            ← 换个邮箱 / 重新获取
          </Button>
        </form>
      )}
    </div>
  );
}
