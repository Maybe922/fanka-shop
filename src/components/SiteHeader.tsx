import Link from "next/link";
import { site } from "@/lib/site";
import { getBuyer } from "@/lib/supabase/auth-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { signOut } from "@/app/login/actions";

export async function SiteHeader() {
  const buyer = await getBuyer();
  const admin = isAdminEmail(buyer?.email);

  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">{site.name}</span>
          <span className="hidden text-sm text-muted sm:inline">{site.tagline}</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          <a href="/#how" className="transition-colors hover:text-ink">
            购买流程
          </a>
          <a href="/#faq" className="hidden transition-colors hover:text-ink sm:inline">
            常见问题
          </a>
          {buyer ? (
            <div className="flex items-center gap-3">
              <Link href="/orders" className="transition-colors hover:text-ink">
                订单中心
              </Link>
              {admin && (
                <Link href="/admin" className="transition-colors hover:text-ink">
                  后台
                </Link>
              )}
              <span className="hidden max-w-[12rem] truncate text-ink sm:inline">
                {buyer.email}
              </span>
              <form action={signOut}>
                <button className="transition-colors hover:text-warn">退出</button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="transition-colors hover:text-ink">
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
