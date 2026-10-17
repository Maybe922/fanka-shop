import Link from "next/link";
import { Button, Popover } from "@heroui/react";
import { site } from "@/lib/site";
import { CustomerService } from "@/components/CustomerService";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getBuyer } from "@/lib/supabase/auth-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { signOut } from "@/app/login/actions";

const navLink =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] text-muted transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-2.5";
const menuLink =
  "block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent";

export async function SiteHeader() {
  const buyer = await getBuyer();
  const admin = isAdminEmail(buyer?.email);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <Link
          href="/"
          aria-label={`${site.name} 首页`}
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={site.logoUrl} alt="" width={36} height={36} className="h-8 w-8 rounded-lg object-contain sm:h-9 sm:w-9" />
          <span className="text-[15px] font-semibold tracking-tight sm:text-base">{site.name}</span>
        </Link>

        <nav aria-label="主导航" className="ml-auto flex shrink-0 items-center gap-0 sm:gap-1">
          <CustomerService />
          <Link href="/help" className={navLink}>
            <svg viewBox="0 0 24 24" fill="none" className="hidden h-4 w-4 sm:block" aria-hidden>
              <path d="M12 5.5C9 3.5 5.5 3.5 2.5 4.5v14c3-1 6.5-1 9.5 1 3-2 6.5-2 9.5-1v-14c-3-1-6.5-1-9.5 1Zm0 0v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            帮助
          </Link>

          {buyer ? (
            <Popover>
              <Button variant="ghost" size="sm" className="h-9 min-w-0 rounded-lg px-2 text-[13px] font-normal text-muted sm:px-2.5">
                账户
              </Button>
              <Popover.Content placement="bottom end" className="w-60 max-w-[calc(100vw-2rem)] p-2">
                <Popover.Dialog aria-label="账户菜单">
                  <p className="break-all border-b border-separator px-3 py-2 text-xs text-muted">{buyer.email}</p>
                  <Link href="/orders" className={`${menuLink} mt-1`}>我的订单</Link>
                  {admin && <Link href="/admin" className={menuLink}>管理后台</Link>}
                  <form action={signOut} className="mt-1 border-t border-separator pt-1">
                    <Button type="submit" variant="ghost" size="sm" fullWidth className="justify-start rounded-lg px-3 font-normal">退出登录</Button>
                  </form>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          ) : (
            <Link href="/login" className={navLink}>登录</Link>
          )}

          <span className="ml-1 flex items-center border-l border-border pl-1 sm:ml-2 sm:pl-2">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  );
}
