// Cloudflare Turnstile 服务端验签。仅服务端调用（读 secret）。
// 校验前端拿到的 token 是否真由 Cloudflare 签发、且未被使用过。
const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// 是否启用人机验证：未配置 secret 时跳过（避免漏配密钥把用户挡在门外）。
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// 验证一个 Turnstile token。失败一律返回 false（fail-closed）。
export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
