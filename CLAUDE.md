# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ 这是 **Next.js 16（App Router + Turbopack）**，API/约定可能与训练数据不同。写任何 Next 代码前，先读 `node_modules/next/dist/docs/` 里的对应指南（见上方 AGENTS.md）。

## 项目是什么

极简自动发卡站：买家付款后**自动发卡密**。前台 `/` 选品下单，后台 `/admin` 进货卡密 + 收钱。
栈：Next.js 16 + Supabase(Postgres) + 虎皮椒支付，部署到 Vercel。完整使用/部署说明见 `README.md`。
UI：**HeroUI v3**（`@heroui/react`，React Aria + Tailwind v4）。主题变量在 `src/app/globals.css` 覆盖（明亮商店风、科技蓝主色 #0285F7）；组件已预编译带 `"use client"`，服务端页面可直接渲染，但事件回调只能在客户端组件传。给 next/link 套按钮样式用 `buttonVariants()`。

## 常用命令

```bash
npm run dev      # 本地开发 http://localhost:3000
npm run build    # 生产构建（含 TypeScript 检查）
npm start        # 跑构建产物
npm run lint     # ESLint
npx tsc --noEmit # 单独类型检查
```

无测试套件。验证改动用 `npx tsc --noEmit` + `npm run build`。

## 架构要点（读多个文件才能拼出的大图）

**两个 Supabase 客户端 —— 用错会导致 `permission denied`：**
- `createPublicClient()`（`lib/supabase/public.ts`，anon key）：**只能**读 `public_products` 视图（无卡密字段）。仅前台落地页用。
- `createServiceClient()`（`lib/supabase/server.ts`，service_role key）：绕过 RLS，**所有真实数据读写都走它**，仅限服务端（route handler / server action / server component）。绝不可 import 进 `"use client"` 模块。

**安全模型（`supabase/schema.sql`）：** 所有表开 RLS 且**无 anon 策略** → anon 只能碰 `public_products` 视图和 `deliver_order` 函数。因此任何访问 `products`/`cards`/`orders` 的代码必须用 service 客户端。视图用 `security_invoker = false`（以所有者权限执行），所以能在不暴露底表的前提下统计库存。

**自动发卡链路（核心）：**
1. `POST /api/orders` → 校验上架+库存 → 插入 `pending` 订单 → `createXunhuOrder()` 拿支付 url → 前端跳转虎皮椒收银台。
2. 付款后虎皮椒异步回调 `POST /api/notify`：先 `verifyXunhuNotify()` 验签，`status==="OD"`（已付）时调用 Postgres 函数 `deliver_order(trade_order_id)`。**回调到不了 localhost，所以自动发卡只在公网域名生效。**
3. `deliver_order()`（schema.sql 内，`security definer`）原子完成「标记已付 + 分配一张未售卡」：`FOR UPDATE SKIP LOCKED` 防并发重复发卡，重复回调幂等（已发则返回原卡）。缺货则标记已付但 `card_id` 留空，待人工处理。
4. 订单页 `/order/[id]` 轮询 `GET /api/orders/[id]`，该接口通过 `card_id` **实时读取 `cards.secret`** —— 所以后台改一张已售卡的内容，买家刷新即看到新卡密（换货机制）。

**虎皮椒集成全部隔离在 `lib/xunhupay.ts`** —— 不同商户的接口/签名细节有差异，要调就只改这一个文件。签名 = 非空参数按 key 升序拼 `k=v&k=v` 后直接追加 secret 再 MD5。
> ⚠️ `wap_url` 必须是**站点根地址**（`new URL(returnUrl).origin`），虎皮椒对它有长度限制，塞入带 UUID 的逐单 return_url 会返回「系统内部错误」。

**鉴权（统一走 Supabase Auth 邮箱验证码登录）：** 买家与后台**共用同一套登录态**，无密码。
- 登录：`/login` 邮箱 OTP（`signInWithOtp` + `verifyOtp`，server actions）。会话 cookie 由 `lib/supabase/auth-server.ts` 的 `createAuthClient()` 读写，`proxy.ts` 每请求刷新。当前买家用 `getBuyer()`（内部 `auth.getUser()`，校验 JWT 不可伪造）。
- 后台权限 = 登录邮箱在 `ADMIN_EMAILS` 白名单内（`lib/admin-auth.ts` 的 `isAdminEmail()` / `isAdmin()`）。`/admin` 页面与每个 server action 都校验：未登录跳 `/login?next=/admin`，已登录非管理员跳 `/`。`/admin/login` 仅保留为兼容旧链接的重定向。

**金额一律存「分」**（`price_cents`/`amount_cents`），展示/虎皮椒交互用 `lib/money.ts` 转「元」。

**环境变量**（`lib/env.ts`）：客户端只读 `publicEnv`（`NEXT_PUBLIC_*`）；服务端机密用 `requireServerEnv(name)`（缺失即抛错）。必需：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`XUNHU_APPID`、`XUNHU_APPSECRET`、`ADMIN_EMAILS`（后台管理员邮箱白名单，逗号分隔）、`NEXT_PUBLIC_SITE_URL`。新版 Supabase key（`sb_publishable_`/`sb_secret_`）可分别当 anon/service_role 用。买家登录的 OTP/SMTP/邮件模板在 **Supabase 后台**配置（不在代码或 env 里）。

## 数据库部署注意

`supabase/schema.sql` 是幂等的，一键建好表/视图/函数/RLS/授权。**用「数据库直连」（psql/连接串）建表时不会触发 Supabase 的自动授权**，因此文件末尾显式 `grant ... to service_role` + `alter default privileges`，保证两种部署方式都不缺权限。改 schema 时这段授权要保留。
