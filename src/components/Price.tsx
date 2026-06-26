import { yuanAmount } from "@/lib/money";

type Props = {
  cents: number;
  /** 整体样式（字号 / 粗细 / 颜色等）。 */
  className?: string;
  /** ¥ 符号的额外样式（如间距 / 强调色）。 */
  symbolClassName?: string;
};

/**
 * 金额展示：¥ 用中文字体（标准双横杠），数字用等宽字体（对齐好看）。
 * IBM Plex Mono 的 ¥ 只有一道横杠，直接放等宽里会"少一束"，故分开渲染。
 */
export function Price({ cents, className, symbolClassName }: Props) {
  return (
    <span className={className}>
      <span className={`font-sans ${symbolClassName ?? ""}`}>¥</span>
      <span className="font-mono">{yuanAmount(cents)}</span>
    </span>
  );
}
