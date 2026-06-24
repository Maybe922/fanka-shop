import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/admin-auth";
import { loginAction } from "../actions";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthenticated()) {
    redirect("/admin");
  }
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-20">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">{site.name} · 后台</h1>
        <p className="mt-1.5 text-sm text-muted">请输入管理员密码登录</p>

        <form action={loginAction} className="mt-6 space-y-3">
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="管理员密码"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          {error && <p className="text-xs text-warn">密码错误，请重试</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            登录
          </button>
        </form>
      </div>
    </main>
  );
}
