import crypto from "node:crypto";

// 飞书（Lark）接入。两条独立的通道，各管各的，互不依赖：
//
//   1) 自定义机器人 webhook（FEISHU_WEBHOOK_URL）—— 只出不进，用于运营告警。
//      群设置里「添加机器人 → 自定义机器人」拿到的地址，无需建应用。
//      纯出站请求，大陆 VPS 也能用（不像 api.telegram.org 会被墙）。
//
//   2) 自建应用（FEISHU_APP_ID/SECRET）—— 用于收命令、回消息、撤回消息。
//      需要在开放平台建应用并订阅 im.message.receive_v1 事件。
//
// 告警走 (1) 而不是 (2)，是刻意的：告警链路不该依赖 token 刷新能不能成功。
// 只想要告警的话，配 (1) 就够了，完全不用碰应用那套。

const FEISHU_BASE = process.env.FEISHU_BASE_URL ?? "https://open.feishu.cn";
const TIMEOUT_MS = 5000;

// ── (1) 自定义机器人：告警推送 ────────────────────────────────────

/**
 * 推一条文本到自定义机器人所在的群。未配置地址则静默跳过。
 *
 * 若群机器人开了「签名校验」，配上 FEISHU_WEBHOOK_SECRET 即可：
 * 签名 = base64(HmacSHA256(key = `{timestamp}\n{secret}`, data = 空))，
 * timestamp 与 sign 放在 JSON body 里（不是 query 参数，网上不少教程写错了）。
 */
export async function sendFeishuAlert(
  title: string,
  text: string,
): Promise<void> {
  const url = process.env.FEISHU_WEBHOOK_URL;
  if (!url) return;

  const body: Record<string, unknown> = {
    msg_type: "text",
    content: { text: `${title}\n${text}` },
  };

  const secret = process.env.FEISHU_WEBHOOK_SECRET;
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    body.timestamp = timestamp;
    body.sign = crypto
      .createHmac("sha256", `${timestamp}\n${secret}`)
      .update("")
      .digest("base64");
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 飞书出错时照样回 HTTP 200，真正的结果在 body 的 code 里。
    const data = (await res.json().catch(() => ({}))) as { code?: number };
    if (!res.ok || data.code !== 0) {
      console.error("[ALERT] 飞书推送被拒", res.status, data.code ?? "无响应码");
    }
  } catch (err) {
    console.error("[ALERT] 飞书推送异常", err);
  }
}

// ── (2) 自建应用：token / 发消息 / 撤回 ───────────────────────────

// tenant_access_token 最长 7200 秒。缓存在模块作用域里，同一个热实例复用；
// 提前 5 分钟判过期，避免正好用到刚失效的那一秒。
let tokenCache: { token: string; expiresAt: number } | null = null;

export function hasFeishuApp(): boolean {
  return Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET);
}

async function tenantAccessToken(): Promise<string | null> {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) return null;

  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  try {
    const res = await fetch(
      `${FEISHU_BASE}/open-apis/auth/v3/tenant_access_token/internal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      code?: number;
      tenant_access_token?: string;
      expire?: number;
    };
    if (data.code !== 0 || !data.tenant_access_token) {
      console.error("[feishu] 取 tenant_access_token 失败", data.code);
      return null;
    }
    tokenCache = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + Math.max(60, (data.expire ?? 7200) - 300) * 1000,
    };
    return tokenCache.token;
  } catch (err) {
    console.error("[feishu] 取 tenant_access_token 异常", err);
    return null;
  }
}

async function appApi(
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: boolean; code: number | null }> {
  const token = await tenantAccessToken();
  if (!token) return { ok: false, code: null };
  try {
    const res = await fetch(`${FEISHU_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as { code?: number };
    const code = data.code ?? null;
    return { ok: code === 0, code };
  } catch (err) {
    console.error(`[feishu] ${init.method} ${path} 异常`, err);
    return { ok: false, code: null };
  }
}

/** 以应用身份往某个会话发文本消息。 */
export async function sendFeishuMessage(
  chatId: string,
  text: string,
  uuid?: string,
): Promise<boolean> {
  // content 必须是「序列化后的 JSON 字符串」而不是对象 —— 飞书 API 的老坑。
  const { ok, code } = await appApi(
    "/open-apis/im/v1/messages?receive_id_type=chat_id",
    {
      method: "POST",
      body: {
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({ text }),
        ...(uuid
          ? {
              uuid: crypto
                .createHash("sha256")
                .update(uuid)
                .digest("hex")
                .slice(0, 50),
            }
          : {}),
      },
    },
  );
  if (!ok) console.error("[feishu] 发送消息失败", code);
  return ok;
}

/**
 * 撤回一条消息（补货后用来抹掉老板粘贴的卡密）。
 *
 * ⚠️ 与 Telegram 的重要差异：飞书应用默认只能撤回「自己发的」消息。
 * 想撤回老板发的那条，机器人必须是该群的群主/管理员，否则返回 230026。
 * 私聊（p2p）里没有群主概念，永远撤不掉 —— 所以补货请在群里做，
 * 并把机器人设为群主。撤不掉时调用方会如实告诉老板「请手动删除」。
 */
export async function recallFeishuMessage(messageId: string): Promise<boolean> {
  const { ok, code } = await appApi(
    `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE" },
  );
  if (!ok && code === 230026) {
    console.error("[feishu] 无权撤回该消息（机器人需为群主/管理员）");
  }
  return ok;
}

// ── 事件订阅：解密 ───────────────────────────────────────────────

/**
 * 解开事件推送里的 encrypt 字段。
 * key = SHA256(Encrypt Key)，AES-256-CBC，IV 是密文前 16 字节，PKCS7 填充。
 */
export function decryptFeishuEvent(
  encrypted: string,
  encryptKey: string,
): string {
  const key = crypto.createHash("sha256").update(encryptKey).digest();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 16);
  const payload = buf.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * 校验飞书事件请求签名。
 * signature = SHA256(timestamp + nonce + encryptKey + rawBody)
 */
export function verifyFeishuEventSignature(
  timestamp: string | null,
  nonce: string | null,
  signature: string | null,
  rawBody: string,
  encryptKey: string,
): boolean {
  if (!timestamp || !nonce || !signature) return false;
  const expected = crypto
    .createHash("sha256")
    .update(timestamp + nonce + encryptKey + rawBody)
    .digest("hex");

  const incomingBuffer = Buffer.from(signature.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    incomingBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(incomingBuffer, expectedBuffer)
  );
}
