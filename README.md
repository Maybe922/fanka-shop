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

# 飞书告警（大陆环境推荐）：群设置 → 添加机器人 → 自定义机器人，复制地址
FEISHU_WEBHOOK_URL=
FEISHU_WEBHOOK_SECRET=              # 群机器人勾了「签名校验」才需要

# 飞书运营机器人：订单通知、查库存、补货、改价（见下方章节）
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
FEISHU_ENCRYPT_KEY=
FEISHU_CHAT_ID=
FEISHU_OWNER_OPEN_ID=               # 老板 open_id；只允许这个用户私聊执行命令，订单通知优先私聊这里
```

告警通道三选一或全配（配了哪个走哪个）。**大陆机房只有飞书和 `ALERT_WEBHOOK_URL` 打得通**，Telegram 出站会被墙。

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

### 飞书运营机器人（大陆推荐）

与 TG 补货能力完全一致（命令实现共用 `src/lib/restock.ts`），但飞书在大陆可用。在 [open.feishu.cn](https://open.feishu.cn) 开发者后台建一个**企业自建应用**：

1. 先在 Supabase SQL Editor 依次执行 [`supabase/migrations/20260814_feishu_restock_hardening.sql`](supabase/migrations/20260814_feishu_restock_hardening.sql)、[`supabase/migrations/20260814_feishu_orders_and_price.sql`](supabase/migrations/20260814_feishu_orders_and_price.sql) 和 [`supabase/migrations/20260814_feishu_paid_notice_only.sql`](supabase/migrations/20260814_feishu_paid_notice_only.sql)，建立消息去重、原子补货、改价审计和支付通知认领。
2. **凭证与基础信息** → 拿 `App ID` / `App Secret`。
3. **权限管理** → 按最小权限开通 `im:message.group_at_msg:readonly`、`im:message:send_as_bot`、`im:message:recall`。
4. **事件与回调** → 配置 `Verification Token` 和 `Encrypt Key`，先把上面的环境变量部署到服务器，再把请求地址填成 `https://你的域名/api/feishu`，并添加事件 **接收消息 `im.message.receive_v1`**。
5. 发布版本 → 把机器人拉进专用群并设为群主/管理员 → 群里发 `@机器人 /list`。第一次可在开放平台的事件日志里找到 `event.message.chat_id`，填入 `FEISHU_CHAT_ID` 后重新部署，再发一次命令试通。

如需私聊机器人，再开通 `im:message.p2p_msg:readonly` 并发布新版本。代码只接受 `FEISHU_OWNER_OPEN_ID` 对应用户的私聊；其他用户即使能找到机器人，也不能查库存、补货或改价。老板先在已绑定群里发送一次 `/list`，服务器只记录其 `open_id` 候选供绑定，不记录消息正文。

支付成功通知会优先发送给 `FEISHU_OWNER_OPEN_ID` 对应的老板私聊；私聊不可用时，才回退到 `FEISHU_CHAT_ID` 对应的运营群。只有飞书实际发送成功后，订单才会记录为已通知。

保存请求地址时飞书会先打一次 URL 验证握手，`/api/feishu` 会原样回 `challenge`——**所以要先部署再保存配置**，否则会提示地址不可用。

机器人只会在虎皮椒回调或主动查单确认订单已经支付后，优先向老板私聊发送“订单支付成功”通知，私聊不可用时才回退到白名单群。内容包括商品、客户邮箱、付款金额、付款时间和订单号。未支付、支付失败或超时订单不会通知；重复回调由数据库原子认领和飞书消息 UUID 双重去重。群内命令：

- `@机器人 /list` — 查看商品价格、库存与编号
- `@机器人 /prices`（或 `/价格`）— 查看每一个商品的当前价格
- `@机器人 /add 序号或商品名`，换行粘贴卡密 — 远程补货
- `@机器人 /price 序号或商品名 新价格` — 修改售价，例如 `/price 1 19.9`
- `@机器人 /help` — 查看帮助

远程改价只接受普通十进制金额（最多两位小数，最高 ¥100,000.00），商品必须唯一匹配；更新与 `product_price_audit` 审计记录在同一数据库事务内完成。飞书事件按 `message_id` 持久化去重，同一条消息不会重复改价。

⚠️ **请在群里补货，并把机器人设为群主或管理员。** 飞书应用默认只能撤回自己发的消息（撤别人的会返回 `230026`）；具备群管理身份后才能撤回你粘贴的卡密。机器人撤不掉时会如实提示你手动删除。回调会先在 3 秒内响应，再由 Next.js `after()` 后台处理；数据库按 `message_id` 去重，重复推送不会重复入库。

### 数据备份（VPS cron）

卡密/订单是店的命根子。`scripts/backup-supabase.mjs` 用 service key 走 REST 把四张业务表全量导出为 gzip JSON（表结构在 `supabase/schema.sql`，git 已管），保留 7 天，失败时 Telegram 报警。在 VPS 上加 cron：

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
| `product_price_audit` | 飞书远程改价审计：商品 / 原价 / 新价 / 群与消息来源 |

发卡靠 Postgres 函数 `deliver_order()` 原子完成（`FOR UPDATE SKIP LOCKED` 防并发重复发卡，重复回调幂等）。

## 安全要点

- `SUPABASE_SERVICE_ROLE_KEY`、`XUNHU_APPSECRET` 仅服务端使用，不会进入浏览器包。
- 所有表开启 RLS；匿名端只能读 `public_products` 视图（无卡密字段）。
- 登录走 Supabase Auth 邮箱验证码（httpOnly cookie 会话）；后台权限 = 登录邮箱在 `ADMIN_EMAILS` 白名单内，每个页面与 server action 都会校验。
- 订单有归属校验：卡密只有下单本人（登录态）能查看。
- 回调接口校验虎皮椒签名后才发卡；同时有主动查单兜底，不依赖回调可达。
