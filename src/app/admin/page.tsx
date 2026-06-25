import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin-auth";
import { getBuyer } from "@/lib/supabase/auth-server";
import {
  getAdminProducts,
  getRecentOrders,
  getAllCards,
  expireStaleOrders,
} from "@/lib/data";
import type { AdminCard } from "@/lib/types";
import { signOut } from "@/app/login/actions";
import { NewProductForm } from "@/components/admin/NewProductForm";
import { AdminProductCard } from "@/components/admin/AdminProductCard";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const buyer = await getBuyer();
  if (!buyer) redirect("/login?next=/admin");
  if (!isAdminEmail(buyer.email)) redirect("/");

  // 回收超时未付订单的库存，确保下方列表状态与库存是最新的。
  await expireStaleOrders();

  const { error, ok } = await searchParams;
  const [products, orders, cards] = await Promise.all([
    getAdminProducts(),
    getRecentOrders(),
    getAllCards(),
  ]);

  const cardsByProduct = new Map<string, AdminCard[]>();
  for (const c of cards) {
    const arr = cardsByProduct.get(c.product_id);
    if (arr) arr.push(c);
    else cardsByProduct.set(c.product_id, [c]);
  }

  return (
    <main className="flex-1">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">
              {site.name} · 后台
            </span>
            <Link href="/" className="text-sm text-muted hover:text-ink">
              查看前台 ↗
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden max-w-[12rem] truncate sm:inline">
              {buyer.email}
            </span>
            <form action={signOut}>
              <button className="transition-colors hover:text-warn">退出登录</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-5 py-10">
        {(error || ok) && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              error
                ? "border border-warn/30 bg-warn/5 text-warn"
                : "border border-ok/30 bg-ok/5 text-ok"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <section>
          <NewProductForm />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            商品与卡密库存
          </h2>
          {products.length === 0 ? (
            <p className="text-sm text-muted">还没有商品，先用上方表单添加一个。</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">最近订单</h2>
          <OrdersTable orders={orders} />
        </section>
      </div>
    </main>
  );
}
