import { createHmac } from "node:crypto";
import { isIP } from "node:net";

// Group common aliases for quotas only; never change the actual login identity.
export function emailQuotaIdentity(email: string): string {
  const [local, rawDomain] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  const base = local.split("+")[0];
  return `${domain === "gmail.com" ? base.replaceAll(".", "") : base}@${domain}`;
}

export function ipQuotaIdentity(ip: string): string | null {
  const family = isIP(ip);
  if (family === 4) return ip;
  if (family !== 6) return null;
  // URL canonicalization also converts dotted IPv4 tails to hex.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const a = left ? left.split(":") : [];
  const b = right ? right.split(":") : [];
  const words = right !== undefined ? [...a, ...Array(8-a.length-b.length).fill("0"), ...b] : a;
  const nums = words.map(w => parseInt(w, 16));
  if (nums.slice(0,5).every(n => n === 0) && nums[5] === 65535) {
    return `${nums[6] >> 8}.${nums[6] & 255}.${nums[7] >> 8}.${nums[7] & 255}`;
  }
  // IPv6 privacy addresses within one /64 share the same quota.
  return nums.slice(0,4).map(n => n.toString(16)).join(":") + "::/64";
}

export function trustedClientIp(headers: Pick<Headers, "get">): string | null {
  // Caddy overwrites this header. Next must listen on loopback only.
  // Never trust caller-controlled X-Forwarded-For / X-Real-IP fallbacks.
  const ip = headers.get("x-fanka-client-ip")?.trim() ?? "";
  return isIP(ip) ? ip : null;
}

export function quotaKey(kind: "email" | "ip", value: string): string {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Missing quota secret");
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

export type EmailQuota = { allowed: boolean; reason?: string; retryAfter?: number };
export function quotaMessage(result: EmailQuota): string {
  switch (result.reason) {
    case "cooldown": return `请等待 ${result.retryAfter ?? 60} 秒后重新获取验证码`;
    case "email_daily": return "此邮箱获取验证码次数已达上限，请稍后再试或联系客服";
    case "ip_daily": return "当前网络获取验证码次数已达上限，请稍后再试或联系客服";
    case "ip_burst": return "当前网络请求较多，请 15 分钟后再试";
    default: return "验证码服务暂时繁忙，请稍后再试或联系客服";
  }
}
