"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/auth-server";

export type AuthResult = { ok: boolean; error: string | null };

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

// 第一步：发送邮箱验证码。shouldCreateUser=true → 首次邮箱自动注册（无密码）。
export async function requestOtp(email: string): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true, error: null };
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
