import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { claimBotMessage, finishBotMessage } from "@/lib/bot-events";
import {
  decryptFeishuEvent,
  hasFeishuApp,
  recallFeishuMessage,
  sendFeishuMessage,
  verifyFeishuEventSignature,
} from "@/lib/feishu";
import { HELP_TEXT, handleAdd, handleList, parseCommand } from "@/lib/restock";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/feishu — 飞书事件订阅回调：老板在飞书里远程补货。
// 命令实现见 lib/restock.ts（与 Telegram 机器人共用）。
//
// 安全模型：Encrypt Key 加密 + 原始包体签名 + Verification Token + chat_id 白名单；
// 数据库按 message_id 持久化去重；命令只进不出，不提供任何读取卡密原文的能力。
//
// 与 Telegram 版的差异：飞书应用撤回不了别人发的消息，除非机器人是群主。
// 所以请在群里补货并把机器人设为群主，否则粘贴的卡密会永久留在聊天记录里。

type FeishuEvent = {
  type?: string; // v1 / url_verification
  challenge?: string;
  token?: string;
  encrypt?: string;
  header?: {
    event_id?: string;
    token?: string;
    event_type?: string;
  };
  event?: {
    message?: {
      message_id?: string;
      chat_id?: string;
      chat_type?: string;
      message_type?: string;
      content?: string; // JSON 字符串，如 {"text":"/list"}
    };
  };
};

// 群里 @机器人 时正文会带 @_user_1 / @_all 这类占位符，先剥掉再解析命令。
function plainText(content: string | undefined): string {
  if (!content) return "";
  let text: string;
  try {
    text = (JSON.parse(content) as { text?: string }).text ?? "";
  } catch {
    return "";
  }
  return text.replace(/@_user_\d+/g, "").replace(/@_all/g, "").trim();
}

export async function POST(req: Request) {
  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!verificationToken || !hasFeishuApp()) {
    // 没配 = 功能未启用；给 503 让误配的订阅地址暴露出来，而不是静默吞掉。
    return new Response("feishu bot not configured", { status: 503 });
  }

  const rawBody = await req.text();
  let body: FeishuEvent;
  try {
    body = JSON.parse(rawBody) as FeishuEvent;
  } catch {
    console.error("[feishu] 回调请求不是合法 JSON", {
      contentType: req.headers.get("content-type"),
      bodyLength: rawBody.length,
    });
    return new Response("bad request", { status: 400 });
  }

  // 仅记录排障所需的结构信息；绝不记录 token、消息正文或卡密。
  console.info("[feishu] 收到回调", {
    type: body.type ?? null,
    eventType: body.header?.event_type ?? null,
    encrypted: typeof body.encrypt === "string",
    hasChallenge: typeof body.challenge === "string",
  });

  // 开了 Encrypt Key 的话，整个包体就是 {"encrypt":"..."}，解开才是真事件。
  if (typeof body.encrypt === "string") {
    const encryptKey = process.env.FEISHU_ENCRYPT_KEY;
    if (!encryptKey) {
      console.error("[feishu] 收到加密事件但未配置 FEISHU_ENCRYPT_KEY");
      return new Response("encrypt key not configured", { status: 503 });
    }
    try {
      body = JSON.parse(
        decryptFeishuEvent(body.encrypt, encryptKey),
      ) as FeishuEvent;
    } catch {
      console.error("[feishu] 事件解密失败");
      return new Response("bad request", { status: 400 });
    }
  }

  // ① URL 验证握手：配置「请求地址」时飞书先打这一发，要在 1 秒内原样回 challenge。
  if (body.type === "url_verification") {
    console.info("[feishu] URL 验证", {
      tokenMatched: body.token === verificationToken,
      hasChallenge: typeof body.challenge === "string",
    });
    if (body.token !== verificationToken) {
      return new Response("forbidden", { status: 403 });
    }
    return Response.json({ challenge: body.challenge });
  }

  // URL 验证请求不要求签名；其余事件在配置 Encrypt Key 后必须先校验原始包体。
  const encryptKey = process.env.FEISHU_ENCRYPT_KEY;
  if (
    encryptKey &&
    !verifyFeishuEventSignature(
      req.headers.get("x-lark-request-timestamp"),
      req.headers.get("x-lark-request-nonce"),
      req.headers.get("x-lark-signature"),
      rawBody,
      encryptKey,
    )
  ) {
    return new Response("invalid signature", { status: 403 });
  }

  // ② Verification Token
  const token = body.header?.token ?? body.token;
  if (token !== verificationToken) {
    return new Response("forbidden", { status: 403 });
  }

  // 之后一律回 200：非 2xx 会让飞书反复重投同一条消息，造成重复入库。
  if (body.header?.event_type !== "im.message.receive_v1") {
    return Response.json({ code: 0 });
  }

  const msg = body.event?.message;
  const ownerChatId = process.env.FEISHU_CHAT_ID;

  // 首次接入时需要从真实事件里取得 chat_id，再写入白名单。
  // 只在尚未配置白名单时记录会话标识，不记录消息正文或发送人。
  if (!ownerChatId && msg?.chat_id) {
    console.info("[feishu] 待绑定会话", { chatId: msg.chat_id });
  }

  // ③ 只认白名单会话里的纯文本消息
  if (
    !msg?.chat_id ||
    !ownerChatId ||
    msg.chat_id !== ownerChatId ||
    msg.message_type !== "text"
  ) {
    return Response.json({ code: 0 });
  }

  const text = plainText(msg.content);
  if (!text || !msg.message_id) return Response.json({ code: 0 });

  // 飞书要求 3 秒内响应。Next.js after() 会在响应发出后继续执行任务；
  // 当前腾讯云是单进程 next start，官方文档明确支持该运行方式。
  const task = {
    chatId: msg.chat_id,
    messageId: msg.message_id,
    eventId: body.header?.event_id,
    text,
  };
  after(() => processMessage(task));
  return Response.json({ code: 0 });
}

async function processMessage(task: {
  chatId: string;
  messageId: string;
  eventId?: string;
  text: string;
}): Promise<void> {
  const supabase = createServiceClient();

  try {
    const claimed = await claimBotMessage(
      supabase,
      "feishu",
      task.messageId,
      task.eventId,
    );
    if (!claimed) return;

    const { command, target, secretLines } = parseCommand(task.text);
    switch (command) {
      case "/start":
      case "/help":
        await sendFeishuMessage(task.chatId, HELP_TEXT, `${task.messageId}:help`);
        break;
      case "/list":
        await sendFeishuMessage(
          task.chatId,
          await handleList(supabase),
          `${task.messageId}:list`,
        );
        break;
      case "/add": {
        const result = await handleAdd(supabase, target, secretLines);
        let note = "";
        if (result.added) {
          // 入库成功 → 撤回带卡密的原消息。机器人非群主时撤不掉（230026），
          // 这时如实提醒老板手动删，别假装成功。
          const recalled = await recallFeishuMessage(task.messageId);
          note = recalled
            ? "\n🧹 你发的卡密消息已自动撤回。"
            : "\n⚠️ 未能自动撤回（机器人需为本群群主），请手动删除那条消息。";
        }
        await sendFeishuMessage(
          task.chatId,
          result.text + note,
          `${task.messageId}:add`,
        );
        break;
      }
      default:
        await sendFeishuMessage(
          task.chatId,
          `不认识的命令：${command}\n\n${HELP_TEXT}`,
          `${task.messageId}:unknown`,
        );
    }
    await finishBotMessage(supabase, "feishu", task.messageId, "completed");
  } catch (err) {
    console.error("[feishu] 处理命令失败", err);
    const message = err instanceof Error ? err.message : String(err);
    await finishBotMessage(
      supabase,
      "feishu",
      task.messageId,
      "failed",
      message,
    );
    await sendFeishuMessage(
      task.chatId,
      "❌ 处理失败，请重新发送命令，或到后台操作。",
      `${task.messageId}:error`,
    );
  }
}
