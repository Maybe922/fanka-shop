import crypto from "node:crypto";
import { requireServerEnv } from "@/lib/env";

// 虎皮椒 / 迅虎支付 integration.
// Docs vary slightly between 虎皮椒 vs 迅虎 accounts — if signatures are
// rejected, confirm the endpoint, `version`, and the sign algorithm against
// the API docs in YOUR 虎皮椒 商户后台, then adjust here. Everything is
// isolated to this file on purpose.

const DEFAULT_API_URL = "https://api.xunhupay.com/payment/do.html";

/**
 * Signature: sort all non-empty params (excluding `hash`) by key ascending,
 * join as `k=v&k=v`, append the app secret directly, then MD5 (lowercase hex).
 */
export function xunhuSign(
  params: Record<string, string | number>,
  secret: string,
): string {
  const base = Object.keys(params)
    .filter(
      (k) =>
        k !== "hash" &&
        params[k] !== "" &&
        params[k] !== undefined &&
        params[k] !== null,
    )
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("md5").update(base + secret).digest("hex");
}

export interface CreateOrderInput {
  tradeOrderId: string;
  totalFeeYuan: string; // e.g. "9.90"
  title: string;
  notifyUrl: string;
  returnUrl: string;
}

export interface CreateOrderResult {
  payUrl: string | null; // hosted cashier page (虎皮椒 自带，丑) — fallback only
  qrUrl: string | null; // 虎皮椒 二维码图片页（302 跳转，非图片）
  qrCode: string | null; // 原始 weixin:// 支付链接 —— 用它自建收银台二维码
  raw: unknown;
}

// 虎皮椒 的 url_qrcode 会 302 跳到 /qrcode/{appid}.html?data=<base64(weixin://...)>。
// 我们解出原始 weixin:// 链接，用来在自己页面生成二维码（不依赖虎皮椒的图片页）。
async function resolveQrCode(qrUrl: string): Promise<string | null> {
  try {
    const res = await fetch(qrUrl, { redirect: "manual", cache: "no-store" });
    const location = res.headers.get("location");
    if (!location) return null;
    const data = new URL(location).searchParams.get("data");
    if (!data) return null;
    const decoded = Buffer.from(data, "base64").toString("utf8");
    return decoded.startsWith("weixin://") ? decoded : null;
  } catch {
    return null;
  }
}

export async function createXunhuOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const appid = requireServerEnv("XUNHU_APPID");
  const secret = requireServerEnv("XUNHU_APPSECRET");
  const apiUrl = process.env.XUNHU_API_URL ?? DEFAULT_API_URL;

  const params: Record<string, string | number> = {
    version: "1.1",
    appid,
    trade_order_id: input.tradeOrderId,
    total_fee: input.totalFeeYuan,
    title: input.title,
    time: Math.floor(Date.now() / 1000),
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    nonce_str: crypto.randomBytes(8).toString("hex"),
    type: "WAP",
    // wap_url 必须是站点根地址（短）。虎皮椒对其有长度限制——
    // 若塞入带 UUID 的逐单 return_url 会返回「系统内部错误」。
    wap_url: new URL(input.returnUrl).origin,
    wap_name: input.title,
  };
  params.hash = xunhuSign(params, secret);

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const qrUrl = typeof data.url_qrcode === "string" ? data.url_qrcode : null;
  const qrCode = qrUrl ? await resolveQrCode(qrUrl) : null;
  return {
    payUrl: typeof data.url === "string" ? data.url : null,
    qrUrl,
    qrCode,
    raw: data,
  };
}

/** Verify the async notify callback signature. */
export function verifyXunhuNotify(params: Record<string, string>): boolean {
  const incoming = params.hash;
  if (!incoming) return false;
  const secret = requireServerEnv("XUNHU_APPSECRET");
  const expected = xunhuSign(params, secret);
  return incoming.toLowerCase() === expected.toLowerCase();
}
