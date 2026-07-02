# 发卡小店 · fanka-shop

极简自动发卡站。买家付款后**自动发卡密**，你只需在后台「进货卡密 + 收钱」。

- **前台**（`/`）：极简商品列表 → 登录（邮箱验证码）→ 下单 → 微信扫码付款 → 订单页自动显示卡密
- **后台**（`/admin`）：白名单邮箱登录 → 商品上下架/改价 → 进货卡密 → 查看订单
- **栈**：Next.js 16（App Router）+ HeroUI v3 + Supabase（Postgres + Auth）+ 虎皮椒支付，部署到 Vercel

---

## 1. 本地运行

```bash
npm install
cp .env.example .env.local   # 然后填入下面第 2、3 步拿到的值
npm run dev                  # http://localhost:3000
```

未配置数据库时前台会显示「暂无商品」，属正常——配置后即出现。

## 2. 配置 Supabase

1. 在 [supabase.com](https://supabase.com) 新建项目。
2. 打开 **SQL Editor**，把 [`supabase/schema.sql`](supabase/schema.sql) 全部内容粘贴运行（一次建好表、视图、发卡函数、RLS）。
3. **Project Settings → API** 复制三个值填进 `.env.local`：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（**机密**，只在服务端用，切勿泄露）

## 3. 配置虎皮椒支付

1. 注册虎皮椒商户，拿到 `XUNHU_APPID` 和 `XUNHU_APPSECRET`，填进 `.env.local`。
2. 自动发卡依赖虎皮椒的**异步回调**。回调地址为 `{你的域名}/api/notify`，付款后跳转地址为 `{你的域名}/order/{订单号}`——这两个由代码自动拼接，你只需保证 `NEXT_PUBLIC_SITE_URL` 配成线上公网域名。
3. ⚠️ **签名算法**：不同虎皮椒/迅虎账号的接口与签名细节可能略有差异。若下单或回调报「签名错误」，对照你商户后台的 API 文档微调 [`src/lib/xunhupay.ts`](src/lib/xunhupay.ts)（签名、接口地址、`status` 取值都集中在这一个文件里）。

## 4. 登录与后台管理员

买家和管理员用**同一套登录**：邮箱验证码（Supabase Auth OTP），无密码。

```bash
# 可进 /admin 的邮箱白名单（逗号分隔可多个）
ADMIN_EMAILS=you@example.com
```

- 白名单邮箱用验证码登录后即拥有后台权限；其他邮箱登录只是普通买家。
- 验证码邮件的 SMTP / 模板在 **Supabase 后台**（Authentication → Emails）配置，不在代码或环境变量里。Supabase 自带邮件服务有频率限制，正式运营建议接自己的 SMTP。

可选配置（不填也能跑）：

```bash
# Cloudflare Turnstile 人机验证（拦在「获取验证码」之前，防机器人刷邮件）
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Telegram 补货/缺货提醒（推荐）：售罄、已付缺货时机器人私聊你
# ⚠️ 大陆机房 VPS 出站到 api.telegram.org 会被墙，先 curl 验证连通性
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# TG 远程补货（可选）：webhook 验签密钥，openssl rand -hex 32 生成（见下方章节）
TELEGRAM_WEBHOOK_SECRET=

# 运营告警 webhook（可选，与 TG 并存；支持 Server酱/PushPlus 等表单式地址）
ALERT_WEBHOOK_URL=
```

### TG 远程补货（可选）

配好上面三个 `TELEGRAM_*` 变量并部署后，注册 webhook（本地终端执行一次，域名换成你的）：

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://你的域名/api/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET 的值>" \
  -d "allowed_updates=[\"message\"]"
```

之后在 TG 里私聊机器人即可远程管库存：

- `/list` — 查看商品与库存
- `/add 序号`（或商品名），换行后粘贴卡密（每行一张）— 补货并重新武装售罄提醒

安全设计：webhook 带 secret_token 验签、只响应你的 chat_id、**只进不出**（没有任何读出卡密的命令）；卡密入库后机器人会立刻删掉你发的原消息，聊天记录不留卡密。想关闭功能：`curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`。

### 数据备份（VPS cron）

卡密/订单是店的命根子。`scripts/backup-supabase.mjs` 用 service key 走 REST 把四张业务表全量导出为 gzip JSON（表结构在 `supabase/schema.sql`，git 已管），保留 30 天，失败时 Telegram 报警。在 VPS 上加 cron：

```bash
crontab -e
# 每天 04:35 备份到 ~/backups/fanka/<日期>/
35 4 * * * cd ~/fanka-shop && /usr/bin/node scripts/backup-supabase.mjs >> ~/backups/fanka/backup.log 2>&1
```

恢复：解压对应表的 `json.gz`，在 Supabase 后台 Table Editor 导入或用 supabase-js 灌回。

### 下单限流（防囤库存）

下单即预占卡 20 分钟，为防脚本囤空库存有三道闸（`src/app/api/orders/route.ts`）：单账号最多 3 笔未付订单、同 IP 最多 6 笔未付订单、单账号每小时最多下 10 单。IP 限流依赖 `orders.ip` 列（schema.sql 已含，老库补一句 `alter table orders add column if not exists ip text;`），列不存在时自动放行不误伤。

---

## 5. 部署到 Vercel

1. 把本目录推到 GitHub，在 Vercel **Import** 该仓库。
2. 在 Vercel **Project Settings → Environment Variables** 填入 `.env.example` 里的**全部**变量。
3. 把 `NEXT_PUBLIC_SITE_URL` 设为 Vercel 给你的正式域名（如 `https://xxx.vercel.app` 或你绑定的域名）。
4. ⚠️ 本地回调在 `localhost` 无法被虎皮椒访问——**自动发卡只在线上生效**。

## 6. 开张流程

1. 访问 `/admin`，用 `ADMIN_EMAILS` 里的邮箱走验证码登录。
2. 「新增商品」填名称、简介、价格。
3. 在该商品卡片里「进货卡密」（每行一个），勾选「上架」保存。
4. 回到前台 `/` 即可看到商品，下单测试。
5. 付款成功 → 订单页几秒内自动显示卡密；后台「最近订单」可见状态。

---

## 数据模型

| 表 | 作用 |
|---|---|
| `products` | 商品：名称 / 简介 / 图片 / 使用说明 / 价格(分) / 是否上架 |
| `cards` | 卡密库存：所属商品 / 卡密内容 / 状态(未售·预占·已售) |
| `orders` | 订单：虎皮椒订单号 / 金额 / 状态 / 买家 / 发出的卡密 |
| `articles` | 首页「相关教程说明」卡片：标题 / 摘要 / 外链 / 是否发布 |

发卡靠 Postgres 函数 `deliver_order()` 原子完成（`FOR UPDATE SKIP LOCKED` 防并发重复发卡，重复回调幂等）。

## 安全要点

- `SUPABASE_SERVICE_ROLE_KEY`、`XUNHU_APPSECRET` 仅服务端使用，不会进入浏览器包。
- 所有表开启 RLS；匿名端只能读 `public_products` 视图（无卡密字段）。
- 登录走 Supabase Auth 邮箱验证码（httpOnly cookie 会话）；后台权限 = 登录邮箱在 `ADMIN_EMAILS` 白名单内，每个页面与 server action 都会校验。
- 订单有归属校验：卡密只有下单本人（登录态）能查看。
- 回调接口校验虎皮椒签名后才发卡；同时有主动查单兜底，不依赖回调可达。
