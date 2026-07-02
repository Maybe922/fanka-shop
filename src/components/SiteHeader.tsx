import Link from "next/link";
import { Button, buttonVariants } from "@heroui/react";
import { site } from "@/lib/site";
import { CustomerService } from "@/components/CustomerService";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getBuyer } from "@/lib/supabase/auth-server";
import { isAdminEmail } from "@/lib/admin-auth";
import { signOut } from "@/app/login/actions";

const navLink =
  "rounded-lg px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-secondary hover:text-foreground";

export async function SiteHeader() {
  const buyer = await getBuyer();
  const admin = isAdminEmail(buyer?.email);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        {/* 品牌：logo + 字号商标 */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={site.logoUrl}
            alt={site.name}
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-contain transition-transform group-hover:-rotate-6"
          />
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

        <nav className="flex items-center gap-0.5">
          <Link href="/#how" className={navLink}>
            流程
          </Link>
          <Link href="/#guides" className={`${navLink} hidden sm:inline`}>
            教程
          </Link>
          <ThemeToggle />

          {buyer ? (
            <div className="ml-1 flex items-center gap-0.5">
              <Link href="/orders" className={navLink}>
                订单
              </Link>
              {admin && (
                <Link
                  href="/admin"
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  后台
                </Link>
              )}
              <span className="ml-1.5 hidden max-w-[11rem] truncate border-l border-border pl-3 text-[13px] sm:inline">
                {buyer.email}
              </span>
              <form action={signOut} className="ml-0.5">
                <Button type="submit" variant="ghost" size="sm">
                  退出
                </Button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className={`${buttonVariants({ variant: "primary", size: "sm" })} ml-1.5`}
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
