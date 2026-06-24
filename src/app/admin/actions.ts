"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  checkPassword,
  createSession,
  destroySession,
  isAuthenticated,
} from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { yuanToCents } from "@/lib/money";

async function assertAuthed(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }
}

function refreshAdmin(): void {
  revalidatePath("/admin");
  revalidatePath("/");
}

// ── Auth ─────────────────────────────────────────────────────

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    redirect("/admin/login?error=1");
  }
  await createSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

// ── Products ─────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().trim().min(1, "请输入商品名称").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  priceYuan: z.coerce.number().min(0, "价格不能为负"),
  sortOrder: z.coerce.number().int().default(0),
});

export async function createProduct(formData: FormData): Promise<void> {
  await assertAuthed();
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
  await assertAuthed();
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
  await assertAuthed();
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
  await assertAuthed();
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
