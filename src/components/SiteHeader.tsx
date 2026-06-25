import Link from "next/link";
import { site } from "@/lib/site";
import { CustomerService } from "@/components/CustomerService";
import { getBuyer } from "@/lib/supabase/auth-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { signOut } from "@/app/login/actions";

export async function SiteHeader() {
  const buyer = await getBuyer();
  const admin = isAdminEmail(buyer?.email);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        {/* 品牌：字号商标 */}
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[7px] bg-ink font-mono text-[15px] font-bold text-bg transition-transform group-hover:-rotate-6">
            双
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">
              {site.name}
            </span>
            <span className="mt-0.5 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:inline">
              auto-delivery
            </span>
          </span>
        </Link>

        {/* 客服联系方式 */}
        <CustomerService />

        <nav className="flex items-center gap-1 font-mono text-[13px] text-muted">
          <a
            href="/#how"
            className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-sunken hover:text-ink"
          >
            流程
          </a>
          <a
            href="/#faq"
            className="hidden rounded-md px-2.5 py-1.5 transition-colors hover:bg-sunken hover:text-ink sm:inline"
          >
            常见问题
          </a>

          {buyer ? (
            <div className="ml-1 flex items-center gap-1">
              <Link
                href="/orders"
                className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-sunken hover:text-ink"
              >
                订单
              </Link>
              {admin && (
                <Link
                  href="/admin"
                  className="rounded-md px-2.5 py-1.5 text-accent transition-colors hover:bg-accent/10"
                >
                  后台
                </Link>
              )}
              <span className="ml-1 hidden max-w-[11rem] truncate border-l border-line pl-3 text-ink sm:inline">
                {buyer.email}
              </span>
              <form action={signOut}>
                <button className="rounded-md px-2.5 py-1.5 transition-colors hover:text-accent">
                  退出
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-1 rounded-md border border-ink bg-ink px-3.5 py-1.5 text-bg transition-colors hover:bg-accent hover:border-accent"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
