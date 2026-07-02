import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST /api/telegram — Telegram Bot webhook：老板在 TG 里远程补货。
//
// 安全模型（三道锁，缺一不可）：
//   1. secret_token 验签：setWebhook 时约定的密钥，Telegram 每次请求都带在
//      X-Telegram-Bot-Api-Secret-Token 头里，不匹配直接 403 —— 伪造请求进不来。
//   2. chat_id 白名单：只处理 TELEGRAM_CHAT_ID 那个私聊的消息，其他人发什么都装死。
//   3. 只进不出：命令只能加卡密/看库存数字，没有任何读出卡密原文的命令，
//      bot 的回复也绝不复述卡密 —— 就算通道被劫持，库里已有的卡密掏不走。
//
// 卡密入库成功后立刻 deleteMessage 删掉老板发的原消息，聊天记录里不留卡密。
// 注意：webhook 需要 Telegram 能回调到本站，只在公网部署（Vercel）生效；
// 大陆 VPS 与 api.telegram.org 不通，此路由在那边永远收不到请求，无副作用。

const TG_TIMEOUT_MS = 5000;
const MAX_SECRETS_PER_MESSAGE = 100; // 单条消息补货上限（TG 消息本身也有 4096 字符限制）
const MAX_SECRET_LENGTH = 500;

const HELP_TEXT = [
  "可用命令：",
  "/list — 查看商品与库存",
  "/add 序号或商品名 — 补货，换行后粘贴卡密（每行一张）",
  "",
  "例：",
  "/add 1",
  "AAAA-BBBB-CCCC",
  "DDDD-EEEE-FFFF",
].join("\n");

type TgMessage = {
  message_id: number;
  text?: string;
  chat: { id: number };
};

type TgUpdate = { message?: TgMessage };

type ServiceClient = ReturnType<typeof createServiceClient>;

// ── Telegram API helper ──────────────────────────────────────────

async function tgCall(
  method: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(TG_TIMEOUT_MS),
    });
    if (!res.ok) {
      // 不打印响应体 —— 可能回显请求内容
      console.error(`[telegram] ${method} 失败`, res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram] ${method} 异常`, err);
    return false;
  }
}

function reply(chatId: number, text: string): Promise<boolean> {
  return tgCall("sendMessage", { chat_id: chatId, text });
}

// ── 命令实现 ─────────────────────────────────────────────────────

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

async function handleList(supabase: ServiceClient): Promise<string> {
  const products = await listProducts(supabase);
  if (products.length === 0) return "还没有商品，先去后台创建一个吧。";
  const lines = products.map((p, i) => {
    const state = p.is_active ? "" : "（已下架）";
    const stock = p.stock > 0 ? `库存 ${p.stock}` : "⚠️ 缺货";
    return `${i + 1}. ${p.name} — ${stock}${state}`;
  });
  return [...lines, "", "补货：/add 序号，换行后粘贴卡密（每行一张）"].join("\n");
}

async function handleAdd(
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
    const fuzzy = exact.length > 0 ? exact : products.filter((p) => p.name.includes(target));
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

  const rows = secrets.map((secret) => ({ product_id: product.id, secret }));
  const { error } = await supabase.from("cards").insert(rows);
  if (error) {
    console.error("[telegram] 补货入库失败", error.message);
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
    text: `✅ 已给「${product.name}」补货 ${secrets.length} 张，当前库存 ${count ?? "?"}。`,
    added: true,
  };
}

// ── Webhook 入口 ─────────────────────────────────────────────────

export async function POST(req: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // 没配密钥 = 功能未启用；给 503 让误注册的 webhook 暴露出来，而不是静默吞掉。
    return new Response("webhook not configured", { status: 503 });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return new Response("forbidden", { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // 之后一律回 200：非 2xx 会让 Telegram 反复重投同一条消息，造成重复入库。
  const msg = update.message;
  const ownerChatId = process.env.TELEGRAM_CHAT_ID;
  const text = msg?.text?.trim();
  if (!msg || !text || !ownerChatId || String(msg.chat.id) !== ownerChatId) {
    return new Response("ok");
  }

  const supabase = createServiceClient();
  const [firstLine, ...restLines] = text.split("\n");
  const [command, ...args] = firstLine.trim().split(/\s+/);

  try {
    switch (command) {
      case "/start":
      case "/help":
        await reply(msg.chat.id, HELP_TEXT);
        break;
      case "/list":
        await reply(msg.chat.id, await handleList(supabase));
        break;
      case "/add": {
        const result = await handleAdd(supabase, args.join(" "), restLines);
        let note = "";
        if (result.added) {
          // 入库成功 → 删掉带卡密的原消息，聊天记录里不留痕。
          const deleted = await tgCall("deleteMessage", {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
          });
          note = deleted
            ? "\n🧹 你发的卡密消息已自动删除。"
            : "\n⚠️ 未能自动删除你发的卡密消息，请手动删除。";
        }
        await reply(msg.chat.id, result.text + note);
        break;
      }
      default:
        await reply(msg.chat.id, `不认识的命令：${command}\n\n${HELP_TEXT}`);
    }
  } catch (err) {
    console.error("[telegram] 处理命令失败", err);
    await reply(msg.chat.id, "❌ 处理失败，请稍后重试或到后台操作。");
  }

  return new Response("ok");
}
