// Prices are stored as integer 分 (cents) to avoid floating-point drift.

// 金额数字部分（不含 ¥），去掉无意义的 .00。配合 <Price> 把符号与数字分开渲染。
export function yuanAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

export function formatCny(cents: number): string {
  return `¥${yuanAmount(cents)}`;
}

export function centsToYuanString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function yuanToCents(yuan: string | number): number {
  return Math.round(Number(yuan) * 100);
}
