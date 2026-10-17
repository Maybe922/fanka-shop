"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/auth-server";
import { isTurnstileEnabled, verifyTurnstile } from "@/lib/turnstile";
import { trustedClientIp } from "@/lib/auth-email-policy";
import { sendLoginCode } from "@/lib/auth-email";

export type AuthResult = { ok: boolean; error: string | null; retryAfter?: number };

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("请输入有效的邮箱地址");

// 把 Supabase 返回的英文错误翻成对买家友好的中文。
function humanize(msg: string): string {
  if (/rate limit|too many|for security purposes|seconds/i.test(msg))
    return "请求过于频繁，请稍后再试";
  if (/expired|invalid|token|otp/i.test(msg))
    return "验证码错误或已过期，请重新获取";
  if (/smtp|sending|email/i.test(msg))
    return "邮件发送失败，请稍后再试或联系客服";
  return msg;
}

// 第一步：人机验证、原子限额预留，再生成并发送验证码。
// turnstileToken：Cloudflare 人机验证 token（配置了 secret 时必校验）。
export async function requestOtp(
  email: string,
  turnstileToken = "",
): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const ip = trustedClientIp(await headers());
  if (!ip) return { ok: false, error: "暂时无法验证网络来源，请稍后再试" };
  if (process.env.NODE_ENV === "production" && !isTurnstileEnabled()) {
    return { ok: false, error: "安全验证暂不可用，请稍后再试" };
  }
  // 人机验证：拦在发邮件之前，挡掉机器人狂刷验证码。
  if (isTurnstileEnabled()) {
    const human = await verifyTurnstile(turnstileToken, ip);
    if (!human) return { ok: false, error: "人机验证未通过，请重试" };
  }

  return sendLoginCode(parsed.data, ip);
}

// 第二步：校验 6 位验证码 → 建立买家会话（cookie 由 createAuthClient 写入）。
export async function verifyOtp(
  email: string,
  token: string,
): Promise<AuthResult> {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) return { ok: false, error: "邮箱无效，请重新开始" };
  const code = token.trim();
  if (!/^\d{6}$/.test(code))
    return { ok: false, error: "请输入 6 位数字验证码" };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsedEmail.data,
    token: code,
    type: "email",
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true, error: null };
}

// 退出登录。
export async function signOut(): Promise<void> {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/");
}
