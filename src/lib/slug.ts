import { randomUUID } from "node:crypto";

// 把任意字符串规整成 URL slug：转小写，非字母数字转连字符，去掉首尾连字符。
// 中文等会被清空——此时回退到随机短码，保证 slug 永远非空且可用。
export function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || `art-${randomUUID().slice(0, 8)}`;
}
