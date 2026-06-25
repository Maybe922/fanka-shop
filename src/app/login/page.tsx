import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getBuyer } from "@/lib/supabase/auth-server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const buyer = await getBuyer();

  // 已登录则直接回跳，不重复登录。
  if (buyer) {
    const dest =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    redirect(dest);
  }

  return (
    <main className="flex-1">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">登录 / 注册</h1>
        <p className="mt-2 text-sm text-muted">
          输入邮箱获取验证码即可登录，首次登录将自动为你创建账号 —— 无需密码。
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
