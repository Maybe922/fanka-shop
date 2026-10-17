import "server-only";
import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase/server";
import { emailQuotaIdentity, ipQuotaIdentity, quotaKey, quotaMessage, type EmailQuota } from "@/lib/auth-email-policy";

export type SendCodeResult = { ok: boolean; error: string | null; retryAfter?: number };

export async function sendLoginCode(email: string, ip: string): Promise<SendCodeResult> {
  try {
    const ipIdentity = ipQuotaIdentity(ip);
    if (!ipIdentity || !process.env.BREVO_SMTP_PASSWORD || !process.env.BREVO_SMTP_USER) throw new Error("Sender not configured");
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("reserve_auth_email", {
      p_email_key: quotaKey("email", emailQuotaIdentity(email)),
      p_ip_key: quotaKey("ip", ipIdentity),
    });
    if (error || !data || typeof data.allowed !== "boolean") throw new Error("Quota unavailable");
    const quota = data as EmailQuota;
    if (!quota.allowed) return { ok: false, error: quotaMessage(quota), retryAfter: quota.retryAfter };

    // This admin API generates an OTP but sends no email. Public Auth sending
    // is blocked by block_direct_auth_email; only this quota-gated path sends.
    const generated = await supabase.auth.admin.generateLink({ type: "magiclink", email });
    const code = generated.data?.properties?.email_otp;
    if (generated.error || !code || !/^\d{6}$/.test(code)) throw new Error("Code generation failed");
    const transport = nodemailer.createTransport({
      host: "smtp-relay.brevo.com", port: 587, secure: false, requireTLS: true,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      logger: false, debug: false,
    });
    await transport.sendMail({
      from: '"双吉AI" <login@auth.cngptplus.shop>', to: email,
      subject: "【双吉AI】你的登录验证码",
      text: `你的登录验证码：${code}。10 分钟内有效，请勿向他人透露。如非本人操作，请忽略此邮件。`,
      html: `<div style="background:#f7f7f7;padding:36px 16px;font-family:Arial,sans-serif;color:#222"><div style="max-width:480px;margin:auto;padding:36px;background:white;border-radius:16px"><h2 style="margin:0">双吉AI</h2><p style="color:#888;font-size:12px">AUTO DELIVERY</p><p>你的登录验证码</p><div style="font-size:36px;font-weight:700;letter-spacing:8px;margin:28px 0">${code}</div><p style="color:#777;line-height:1.8">10 分钟内有效，请勿向他人透露。<br>如非本人操作，请忽略此邮件。</p><hr style="border:0;border-top:1px solid #eee;margin:28px 0"><p style="font-size:12px;color:#999">双吉AI · 付款后自动发卡</p></div></div>`,
    });
    return { ok: true, error: null, retryAfter: 60 };
  } catch {
    // Failed/ambiguous sends retain their reservation: retries cannot overspend.
    // Never log OTPs, SMTP credentials, email addresses or provider responses.
    console.error("[auth-email] Unable to send login code");
    return { ok: false, error: "验证码发送暂时失败，请稍后再试或联系客服", retryAfter: 60 };
  }
}
