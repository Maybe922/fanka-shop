import { getBuyer } from "@/lib/supabase/auth-server";

// 后台管理员 = 登录邮箱在 ADMIN_EMAILS 白名单内（逗号分隔，可多个）。
// 不再用密码：靠 Supabase 邮箱验证码确认邮箱所有权 —— 既安全又免去记密码。
// 后台与买家共用同一套 Supabase 登录态，仅凭邮箱区分权限。
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// 纯函数：某邮箱是否为管理员。
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// 当前请求是否为管理员（已登录 + 邮箱在白名单内）。
export async function isAdmin(): Promise<boolean> {
  const buyer = await getBuyer();
  return isAdminEmail(buyer?.email);
}
