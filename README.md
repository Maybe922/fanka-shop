# 发卡小店 · fanka-shop

极简自动发卡站。买家付款后**自动发卡密**，你只需在后台「进货卡密 + 收钱」。

- **前台**（`/`）：极简商品列表 → 点购买 → 虎皮椒收银台付款 → 订单页自动显示卡密
- **后台**（`/admin`）：密码登录 → 商品上下架/改价 → 进货卡密 → 查看订单
- **栈**：Next.js 16（App Router）+ Supabase（Postgres）+ 虎皮椒支付，部署到 Vercel

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

## 4. 后台密码

```bash
ADMIN_PASSWORD=设一个强密码
SESSION_SECRET=$(openssl rand -hex 32)   # 用于签名后台会话 cookie
```

---

## 5. 部署到 Vercel

1. 把本目录推到 GitHub，在 Vercel **Import** 该仓库。
2. 在 Vercel **Project Settings → Environment Variables** 填入 `.env.example` 里的**全部**变量。
3. 把 `NEXT_PUBLIC_SITE_URL` 设为 Vercel 给你的正式域名（如 `https://xxx.vercel.app` 或你绑定的域名）。
4. ⚠️ 本地回调在 `localhost` 无法被虎皮椒访问——**自动发卡只在线上生效**。

## 6. 开张流程

1. 访问 `/admin`，用 `ADMIN_PASSWORD` 登录。
2. 「新增商品」填名称、简介、价格。
3. 在该商品卡片里「进货卡密」（每行一个），勾选「上架」保存。
4. 回到前台 `/` 即可看到商品，下单测试。
5. 付款成功 → 订单页几秒内自动显示卡密；后台「最近订单」可见状态。

---

## 数据模型

| 表 | 作用 |
|---|---|
| `products` | 商品：名称 / 简介 / 价格(分) / 是否上架 |
| `cards` | 卡密库存：所属商品 / 卡密内容 / 状态(未售·已售) |
| `orders` | 订单：虎皮椒订单号 / 金额 / 状态 / 发出的卡密 |

发卡靠 Postgres 函数 `deliver_order()` 原子完成（`FOR UPDATE SKIP LOCKED` 防并发重复发卡，重复回调幂等）。

## 安全要点

- `SUPABASE_SERVICE_ROLE_KEY`、`XUNHU_APPSECRET` 仅服务端使用，不会进入浏览器包。
- 所有表开启 RLS；前台只能读 `public_products` 视图（无卡密字段）。
- 后台所有写操作都校验登录态 + zod 入参校验。
- 回调接口校验虎皮椒签名后才发卡。
- 后台用 httpOnly cookie 会话，生产环境务必设强密码。
