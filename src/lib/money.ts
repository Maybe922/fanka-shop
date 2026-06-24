// Prices are stored as integer 分 (cents) to avoid floating-point drift.

export function formatCny(cents: number): string {
  const yuan = (cents / 100).toFixed(2).replace(/\.00$/, "");
  return `¥${yuan}`;
}

export function centsToYuanString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function yuanToCents(yuan: string | number): number {
  return Math.round(Number(yuan) * 100);
}
