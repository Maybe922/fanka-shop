import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type AddCardsResult = {
  added: number;
  skipped: number;
};

/**
 * 原子补货并跳过该商品历史上已经出现过的卡密。
 *
 * 新版数据库通过 add_cards_unique() + advisory lock 实现并发安全。为了让应用
 * 代码可以先于 SQL 迁移部署，函数不存在时退回到查询后插入；远程补货启用前
 * 仍必须执行 supabase/migrations 中的迁移。
 */
export async function addUniqueCards(
  supabase: ServiceClient,
  productId: string,
  secrets: string[],
): Promise<AddCardsResult> {
  const { data, error } = await supabase.rpc("add_cards_unique", {
    p_product_id: productId,
    p_secrets: secrets,
  });

  if (!error) {
    const added = Number(data ?? 0);
    return { added, skipped: Math.max(0, secrets.length - added) };
  }

  // PGRST202：PostgREST schema cache 里找不到函数（尚未执行迁移）。
  if (error.code !== "PGRST202") throw new Error(error.message);

  console.warn("[cards] add_cards_unique 尚未迁移，使用非原子兼容模式");
  const { data: existing, error: existingError } = await supabase
    .from("cards")
    .select("secret")
    .eq("product_id", productId)
    .in("secret", secrets);
  if (existingError) throw new Error(existingError.message);

  const seen = new Set((existing ?? []).map((row) => row.secret));
  const fresh = secrets.filter((secret) => !seen.has(secret));
  if (fresh.length > 0) {
    const { error: insertError } = await supabase.from("cards").insert(
      fresh.map((secret) => ({ product_id: productId, secret })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  return { added: fresh.length, skipped: secrets.length - fresh.length };
}
