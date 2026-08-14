import { createServiceClient } from "@/lib/supabase/server";
import { HELP_TEXT, handleAdd, handleList, parseCommand } from "@/lib/restock";

export const runtime = "nodejs";

// POST /api/telegram — Telegram Bot webhook：老板在 TG 里远程补货。
// 命令实现见 lib/restock.ts（与飞书机器人共用）。
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
// 大陆环境请改用飞书机器人（api/feishu），能力完全一致。

const TG_TIMEOUT_MS = 5000;

type TgMessage = {
  message_id: number;
  text?: string;
  chat: { id: number };
};

type TgUpdate = { message?: TgMessage };

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
  const { command, target, secretLines } = parseCommand(text);

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
        const result = await handleAdd(supabase, target, secretLines);
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
