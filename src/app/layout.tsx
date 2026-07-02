import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// 拉丁字 / 数字 / 价格 / 编号的签名字体 —— 等宽，呼应"卡密=密钥"主题。
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// 正式站在 VPS（无 VERCEL 变量），可被搜索引擎收录。
// Vercel 部署仅作测试环境（VERCEL=1）→ noindex，避免与正式站抢 SEO、防被收录。
const isTestEnv = process.env.VERCEL === "1";

export const metadata: Metadata = {
  title: "双吉AI · 付款后秒发卡密",
  description: "双吉AI — 选好商品、扫码支付，卡密数秒自动送达。",
  ...(isTestEnv ? { robots: { index: false, follow: false } } : {}),
};

// 首屏无闪烁恢复深色偏好：在正文渲染前同步执行，只读 localStorage 常量键。
// 默认浅色（品牌主形态）；用户手动切过深色才记忆为深色。
const THEME_INIT = `(function(){try{if(localStorage.getItem("theme")==="dark"){var e=document.documentElement;e.classList.remove("light");e.classList.add("dark");e.dataset.theme="dark"}}catch(t){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      data-theme="light"
      className={`${plexMono.variable} light h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
