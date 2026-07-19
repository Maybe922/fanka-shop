import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Button } from "@heroui/react";
import { isAdminEmail } from "@/lib/admin-auth";
import { getBuyer } from "@/lib/supabase/auth-server";
import {
  getAdminProducts,
  getOrdersPage,
  getAllCards,
  getPaidOrderStats,
  getAdminArticles,
  expireStaleOrders,
} from "@/lib/data";
import type { AdminCard } from "@/lib/types";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NewProductForm } from "@/components/admin/NewProductForm";
import { AdminProductCard } from "@/components/admin/AdminProductCard";
import { NewArticleForm } from "@/components/admin/NewArticleForm";
import { AdminArticleCard } from "@/components/admin/AdminArticleCard";
import { StatsOverview } from "@/components/admin/StatsOverview";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; page?: string }>;
}) {
  const buyer = await getBuyer();
  if (!buyer) redirect("/login?next=/admin");
  if (!isAdminEmail(buyer.email)) redirect("/");

  // 回收超时未付订单的库存，确保下方列表状态与库存是最新的。
  await expireStaleOrders();

  const { error, ok, page: pageParam } = await searchParams;
  const ORDERS_PAGE_SIZE = 20;
  const page = Math.max(1, Number(pageParam) || 1);
  const [products, ordersPage, cards, paidStats, articles] = await Promise.all([
    getAdminProducts(),
    getOrdersPage(page, ORDERS_PAGE_SIZE),
    getAllCards(),
    getPaidOrderStats(),
    getAdminArticles(),
  ]);

  const stockLeft = products.reduce((sum, p) => sum + p.stock, 0);
  // 上架但售罄的商品——顶部横幅提醒补货（下架的不催；客服定制无库存概念，也不催）。
  const soldOutActive = products.filter(
    (p) => p.is_active && !p.contact_only && p.stock < 1,
  );

  const cardsByProduct = new Map<string, AdminCard[]>();
  for (const c of cards) {
    const arr = cardsByProduct.get(c.product_id);
    if (arr) arr.push(c);
    else cardsByProduct.set(c.product_id, [c]);
  }

  return (
    <main className="flex-1">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">
              {site.name} · 后台
            </span>
            <Link
              href="/"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              查看前台 ↗
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden max-w-[12rem] truncate sm:inline">
              {buyer.email}
            </span>
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                退出登录
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-5 py-10">
        {(error || ok) && (
          <Alert status={error ? "danger" : "success"}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error ?? ok}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {soldOutActive.length > 0 && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                {soldOutActive.length} 个上架商品已售罄
              </Alert.Title>
              <Alert.Description>
                {soldOutActive.map((p) => p.name).join("、")}
                ——买家现在看到的是「暂时缺货」，记得在下方进货补卡。
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <StatsOverview
          stockLeft={stockLeft}
          soldOrders={paidStats.soldOrders}
          revenueCents={paidStats.revenueCents}
        />

        {/* 「新增商品」归属本栏：标题在上，新增入口 + 商品列表都在其下 */}
        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            商品与卡密库存
          </h2>
          <NewProductForm />
          {products.length === 0 ? (
            <p className="mt-5 text-sm text-muted">
              还没有商品，先用上方「新增商品」添加一个。
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {products.map((p) => (
                <AdminProductCard
                  key={p.id}
                  product={p}
                  cards={cardsByProduct.get(p.id) ?? []}
                />
              ))}
            </div>
          )}
        </section>

        <section id="articles">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            教程文章
          </h2>
          <NewArticleForm />
          {articles.length === 0 ? (
            <p className="mt-5 text-sm text-muted">
              还没有文章，用上方「新增教程」写第一篇。发布后会出现在首页「相关教程说明」。
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {articles.map((a) => (
                <AdminArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </section>

        <section id="orders">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">最近订单</h2>
          <OrdersTable
            orders={ordersPage.orders}
            page={page}
            pageSize={ORDERS_PAGE_SIZE}
            total={ordersPage.total}
          />
        </section>
      </div>
    </main>
  );
}
