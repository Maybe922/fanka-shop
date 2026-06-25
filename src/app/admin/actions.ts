"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin-auth";
import { getBuyer } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { yuanToCents } from "@/lib/money";

// 后台写操作守卫：未登录跳登录页，已登录但非管理员跳首页。
async function assertAdmin(): Promise<void> {
  const buyer = await getBuyer();
  if (!buyer) redirect("/login?next=/admin");
  if (!isAdminEmail(buyer.email)) redirect("/");
}

function refreshAdmin(): void {
  revalidatePath("/admin");
  revalidatePath("/");
}

// 登录/退出统一走买家那套（Supabase）：登录在 /login，退出用 @/app/login/actions 的 signOut。

// ── Products ─────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().trim().min(1, "请输入商品名称").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  priceYuan: z.coerce.number().min(0, "价格不能为负"),
  sortOrder: z.coerce.number().int().default(0),
});

export async function createProduct(formData: FormData): Promise<void> {
  await assertAdmin();
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    priceYuan: formData.get("priceYuan"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) {
    redirect("/admin?error=" + encodeURIComponent(parsed.error.issues[0].message));
  }
  const { name, description, priceYuan, sortOrder } = parsed.data;

  const supabase = createServiceClient();
  const { error } = await supabase.from("products").insert({
    name,
    description: description || null,
    price_cents: yuanToCents(priceYuan),
    sort_order: sortOrder,
  });
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));

  refreshAdmin();
  redirect("/admin");
}

const updateSchema = productSchema.extend({
  id: z.string().uuid(),
  isActive: z.coerce.boolean().default(false),
});

export async function updateProduct(formData: FormData): Promise<void> {
  await assertAdmin();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
    priceYuan: formData.get("priceYuan"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    redirect("/admin?error=" + encodeURIComponent(parsed.error.issues[0].message));
  }
  const { id, name, description, priceYuan, sortOrder, isActive } = parsed.data;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("products")
    .update({
      name,
      description: description || null,
      price_cents: yuanToCents(priceYuan),
      sort_order: sortOrder,
      is_active: isActive,
    })
    .eq("id", id);
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));

  refreshAdmin();
  redirect("/admin");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin?error=参数错误");

  const supabase = createServiceClient();
  const { error } = await supabase.from("products").delete().eq("id", id.data);
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));

  refreshAdmin();
  redirect("/admin");
}

// ── Cards (进货) ──────────────────────────────────────────────

const addCardsSchema = z.object({
  productId: z.string().uuid(),
  secrets: z.string().min(1, "请粘贴卡密"),
});

export async function addCards(formData: FormData): Promise<void> {
  await assertAdmin();
  const parsed = addCardsSchema.safeParse({
    productId: formData.get("productId"),
    secrets: formData.get("secrets"),
  });
  if (!parsed.success) {
    redirect("/admin?error=" + encodeURIComponent(parsed.error.issues[0].message));
  }

  // One 卡密 per line; trim, drop blanks and duplicates.
  const lines = Array.from(
    new Set(
      parsed.data.secrets
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  if (lines.length === 0) redirect("/admin?error=没有有效的卡密");

  const supabase = createServiceClient();
  const rows = lines.map((secret) => ({
    product_id: parsed.data.productId,
    secret,
  }));
  const { error } = await supabase.from("cards").insert(rows);
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));

  refreshAdmin();
  redirect("/admin?ok=" + encodeURIComponent(`已进货 ${lines.length} 张卡密`));
}

// ── Card management（单张卡密：改内容 / 删除）────────────────────

const updateCardSchema = z.object({
  cardId: z.string().uuid(),
  secret: z.string().trim().min(1, "卡密内容不能为空"),
});

// 改卡密内容。已售卡也可改——订单页实时读 cards.secret，
// 改完买家刷新即看到新值（用于更换出问题的卡密）。
export async function updateCardSecret(formData: FormData): Promise<void> {
  await assertAdmin();
  const parsed = updateCardSchema.safeParse({
    cardId: formData.get("cardId"),
    secret: formData.get("secret"),
  });
  if (!parsed.success) {
    redirect("/admin?error=" + encodeURIComponent(parsed.error.issues[0].message));
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("cards")
    .update({ secret: parsed.data.secret })
    .eq("id", parsed.data.cardId);
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));

  refreshAdmin();
  redirect("/admin?ok=" + encodeURIComponent("卡密已更新"));
}

// 删除单张卡密。仅允许删未售的——已售卡被订单引用，删除会破坏订单记录，
// 如需处理已售出的问题卡，请改它的内容（换货）而非删除。
export async function deleteCard(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = z.string().uuid().safeParse(formData.get("cardId"));
  if (!id.success) redirect("/admin?error=参数错误");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", id.data)
    .eq("status", "unsold")
    .select("id");
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));
  if (!data || data.length === 0) {
    redirect(
      "/admin?error=" +
        encodeURIComponent("该卡密已售出，不能删除；如需处理请直接编辑其内容（换货）"),
    );
  }

  refreshAdmin();
  redirect("/admin?ok=" + encodeURIComponent("卡密已删除"));
}
