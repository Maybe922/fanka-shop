import { revalidatePath } from "next/cache";
import { addUniqueCards } from "@/lib/card-stock";
import type { createServiceClient } from "@/lib/supabase/server";

// 机器人补货命令的共享实现 —— Telegram（api/telegram）与飞书（api/feishu）
// 共用这一套「/list 看库存、/add 补卡密」逻辑，改一处两边同时生效。
// 各平台的差异（验签、回消息、撤回原消息）留在各自的路由里，这里只管业务。
//
// 安全约定（两个平台一致）：只进不出 —— 没有任何命令能读出卡密原文，
// 回复里也绝不复述卡密。就算某个通道被劫持，库里已有的卡密也掏不走。

type ServiceClient = ReturnType<typeof createServiceClient>;

export const MAX_SECRETS_PER_MESSAGE = 100; // 单条消息补货上限
export const MAX_SECRET_LENGTH = 500;

export const HELP_TEXT = [
  "可用命令：",
  "/list — 查看商品与库存",
  "/add 序号或商品名 — 补货，换行后粘贴卡密（每行一张）",
  "",
  "例：",
  "/add 1",
  "AAAA-BBBB-CCCC",
  "DDDD-EEEE-FFFF",
].join("\n");

// 商品排序与 /list 的编号必须一致（sort_order → created_at），/add 按序号找的
// 就是这份列表里的第 N 个。
async function listProducts(supabase: ServiceClient) {
  const { data, error } = await supabase
    .from("product_stock")
    .select("id, name, stock, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    name: string;
    stock: number;
    is_active: boolean;
  }[];
}

export async function handleList(supabase: ServiceClient): Promise<string> {
  const products = await listProducts(supabase);
  if (products.length === 0) return "还没有商品，先去后台创建一个吧。";
  const lines = products.map((p, i) => {
    const state = p.is_active ? "" : "（已下架）";
    const stock = p.stock > 0 ? `库存 ${p.stock}` : "⚠️ 缺货";
    return `${i + 1}. ${p.name} — ${stock}${state}`;
  });
  return [...lines, "", "补货：/add 序号，换行后粘贴卡密（每行一张）"].join("\n");
}

export async function handleAdd(
  supabase: ServiceClient,
  target: string,
  secretLines: string[],
): Promise<{ text: string; added: boolean }> {
  if (!target) {
    return { text: `请带上商品序号或名称。\n\n${HELP_TEXT}`, added: false };
  }

  // 去空行、去重、限长 —— 与后台「进货」同一套清洗规则。
  const secrets = Array.from(
    new Set(secretLines.map((s) => s.trim()).filter(Boolean)),
  );
  if (secrets.length === 0) {
    return {
      text: "没有收到卡密。命令下一行开始粘贴卡密，每行一张。",
      added: false,
    };
  }
  if (secrets.length > MAX_SECRETS_PER_MESSAGE) {
    return {
      text: `一次最多补 ${MAX_SECRETS_PER_MESSAGE} 张，请分多条消息发送。`,
      added: false,
    };
  }
  const tooLong = secrets.find((s) => s.length > MAX_SECRET_LENGTH);
  if (tooLong) {
    return {
      text: `有一条卡密超过 ${MAX_SECRET_LENGTH} 字符，看起来不像卡密，已全部拒收。`,
      added: false,
    };
  }

  // 找商品：纯数字按 /list 序号，否则先精确后模糊匹配名称；歧义时拒绝并列出候选。
  const products = await listProducts(supabase);
  let product: (typeof products)[number] | undefined;
  if (/^\d+$/.test(target)) {
    product = products[Number(target) - 1];
    if (!product) {
      return {
        text: `没有第 ${target} 号商品，发 /list 查看当前编号。`,
        added: false,
      };
    }
  } else {
    const exact = products.filter((p) => p.name === target);
    const fuzzy =
      exact.length > 0 ? exact : products.filter((p) => p.name.includes(target));
    if (fuzzy.length === 0) {
      return { text: `找不到商品「${target}」，发 /list 查看列表。`, added: false };
    }
    if (fuzzy.length > 1) {
      return {
        text: `「${target}」匹配到多个商品：${fuzzy.map((p) => p.name).join("、")}。请用 /list 里的序号指定。`,
        added: false,
      };
    }
    product = fuzzy[0];
  }

  let result;
  try {
    result = await addUniqueCards(supabase, product.id, secrets);
  } catch (error) {
    console.error("[restock] 补货入库失败", error);
    return { text: "❌ 入库失败，请稍后重试或到后台补货。", added: false };
  }

  // 补货后重新武装「售罄提醒」（同后台进货；列未建时忽略错误）。
  await supabase
    .from("products")
    .update({ soldout_alerted_at: null })
    .eq("id", product.id);

  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product.id)
    .eq("status", "unsold");

  revalidatePath("/");
  revalidatePath("/admin");

  return {
    text:
      result.skipped > 0
        ? `✅ 已给「${product.name}」新增 ${result.added} 张，跳过 ${result.skipped} 张历史重复卡密，当前库存 ${count ?? "?"}。`
        : `✅ 已给「${product.name}」补货 ${result.added} 张，当前库存 ${count ?? "?"}。`,
    // 即使全部都是重复卡密，也要撤回/删除包含卡密原文的聊天消息。
    added: true,
  };
}

/**
 * 把一条聊天消息解析成命令。两个平台的消息体不同，但正文格式一样：
 * 首行是「命令 + 参数」，其余行是卡密。
 */
export function parseCommand(text: string): {
  command: string;
  target: string;
  secretLines: string[];
} {
  const [firstLine, ...restLines] = text.split("\n");
  const [command, ...args] = firstLine.trim().split(/\s+/);
  return { command, target: args.join(" "), secretLines: restLines };
}
