export const MAX_PRICE_CENTS = 10_000_000; // ¥100,000.00

export type PriceCommandArgs =
  | { ok: true; productTarget: string; newPriceCents: number }
  | { ok: false; error: string };

/**
 * 解析 `/price 商品 19.9` 中命令后的部分。价格固定放最后，因此商品名可含空格。
 * 只接受普通十进制写法，拒绝指数、负数和超过两位小数，避免金额歧义。
 */
export function parsePriceCommandArgs(input: string): PriceCommandArgs {
  const trimmed = input.trim();
  const match = trimmed.match(/^(.*?)\s+[¥￥]?([0-9]+(?:\.[0-9]{1,2})?)$/);
  if (!match) {
    return {
      ok: false,
      error: "格式：/price 商品序号或名称 新价格，例如 /price 1 19.9",
    };
  }

  const productTarget = match[1].trim();
  if (!productTarget) {
    return { ok: false, error: "请指定商品序号或名称。" };
  }

  const [yuanPart, decimalPart = ""] = match[2].split(".");
  const newPriceCents =
    Number(yuanPart) * 100 + Number(decimalPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(newPriceCents) || newPriceCents > MAX_PRICE_CENTS) {
    return { ok: false, error: "价格不能超过 ¥100,000.00。" };
  }

  return { ok: true, productTarget, newPriceCents };
}
