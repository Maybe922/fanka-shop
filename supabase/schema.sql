-- ┌─────────────────────────────────────────────────────────────┐
-- │ 发卡小店 — Supabase schema                                     │
-- │ Run this whole file in the Supabase SQL Editor (one click).   │
-- └─────────────────────────────────────────────────────────────┘

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  usage_notes text,                                      -- 使用教程/说明（订单页展示，后台编辑）
  image_url   text,                                      -- 商品图片链接（前台卡片封面）
  price_cents integer not null check (price_cents >= 0), -- 价格（分）
  is_active   boolean not null default true,             -- 是否上架
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists cards (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  secret     text not null,                                -- 卡密内容
  status     text not null default 'unsold' check (status in ('unsold','reserved','sold')), -- 未售/已预占/已售
  order_id   uuid,
  sold_at    timestamptz,
  created_at timestamptz not null default now()
);

-- 教程卡片（后台维护，首页「相关教程说明」卡片）。每张卡片指向一个外部链接
-- （如飞书文档），用户点卡片直接跳转到外链查看教程。
create table if not exists articles (
  id           uuid primary key default gen_random_uuid(),
  tag          text not null default '教程',          -- 分类标签（卡片上显示）
  title        text not null,
  summary      text not null default '',              -- 卡片摘要
  link_url     text not null default '',              -- 教程外链（飞书等）
  is_published boolean not null default false,        -- 草稿默认不公开
  sort_order   integer not null default 0,            -- 小在前
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- 兼容旧结构（若曾建过带 slug/content 的版本）：补 link_url，放开 slug 非空约束。
alter table articles add column if not exists link_url text not null default '';
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'articles' and column_name = 'slug') then
    alter table articles alter column slug drop not null;
  end if;
end $$;

create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products(id),
  trade_order_id text not null unique,                     -- 我方订单号（发给虎皮椒）
  amount_cents   integer not null,
  status         text not null default 'pending' check (status in ('pending','paid','expired')), -- 待支付/已支付/已过期
  card_id        uuid references cards(id),                -- 预占/发出的卡密
  user_id        uuid references auth.users(id) on delete set null, -- 下单买家
  email          text,                                     -- 下单买家邮箱（冗余，便于展示/找回）
  pay_code       text,                                     -- 虎皮椒返回的 weixin:// 支付码（自建收银台用）
  expires_at     timestamptz,                              -- 待支付超时时间（默认下单 +20min）
  contact        text,
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- 兼容已存在的表：补列、放宽 status 取值（幂等）。
alter table products add column if not exists usage_notes text;
alter table products add column if not exists image_url text;
alter table products add column if not exists soldout_alerted_at timestamptz; -- 「售罄补货」提醒去重（进货时清空）
alter table orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table orders add column if not exists email text;
alter table orders add column if not exists pay_code text;
alter table orders add column if not exists expires_at timestamptz;
alter table orders add column if not exists stock_alerted_at timestamptz; -- 「已付但缺货」告警去重标记
alter table orders add column if not exists ip text; -- 下单来源 IP（限流：同 IP 未付订单上限）

alter table cards  drop constraint if exists cards_status_check;
alter table cards  add  constraint cards_status_check  check (status in ('unsold','reserved','sold'));
alter table orders drop constraint if exists orders_status_check;
alter table orders add  constraint orders_status_check check (status in ('pending','paid','expired'));

create index if not exists idx_cards_product_status on cards (product_id, status);
create index if not exists idx_articles_published on articles (is_published, sort_order, created_at);
create index if not exists idx_orders_created on orders (created_at desc);
create index if not exists idx_orders_user on orders (user_id, created_at desc);
create index if not exists idx_orders_ip_pending on orders (ip) where status = 'pending'; -- 限流查询用

-- ── 下单即预占：原子取一张未售卡，建 pending 订单并锁定该卡 ──────
-- 返回新订单 id；无库存返回 null（调用方据此报缺货）。库存随之 -1。
create or replace function create_order_reserved(
  p_product_id     uuid,
  p_trade_order_id text,
  p_amount_cents   integer,
  p_user_id        uuid,
  p_email          text,
  p_expires_at     timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id  uuid;
  v_order_id uuid;
begin
  -- 并发安全地取一张未售卡
  select id into v_card_id
  from cards
  where product_id = p_product_id and status = 'unsold'
  order by created_at
  for update skip locked
  limit 1;

  if v_card_id is null then
    return null; -- 缺货
  end if;

  insert into orders (product_id, trade_order_id, amount_cents, status,
                      card_id, user_id, email, expires_at)
  values (p_product_id, p_trade_order_id, p_amount_cents, 'pending',
          v_card_id, p_user_id, p_email, p_expires_at)
  returning id into v_order_id;

  update cards set status = 'reserved', order_id = v_order_id where id = v_card_id;
  return v_order_id;
end;
$$;

-- ── 取消未支付订单：释放预占卡 + 删除订单（虎皮椒下单失败时回滚）──
create or replace function cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id uuid;
begin
  select card_id into v_card_id from orders
  where id = p_order_id and status = 'pending' for update;
  if v_card_id is not null then
    update cards set status = 'unsold', order_id = null
    where id = v_card_id and status = 'reserved';
  end if;
  delete from orders where id = p_order_id and status = 'pending';
end;
$$;

-- ── 过期清理：把超时未付的 pending 订单标记 expired，并释放其预占卡 ──
-- 机会式调用（下单时 / 后台加载 / 买家轮询自己的订单时）。返回过期条数。
create or replace function expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- 先把这些订单预占的卡放回库存
  update cards c
    set status = 'unsold', order_id = null
  from orders o
  where c.order_id = o.id
    and c.status = 'reserved'
    and o.status = 'pending'
    and o.expires_at is not null
    and o.expires_at < now();

  -- 再把订单标记为已过期，并清掉 card_id
  with expired as (
    update orders
      set status = 'expired', card_id = null
    where status = 'pending'
      and expires_at is not null
      and expires_at < now()
    returning 1
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

-- ── Atomic delivery: 付款回调时发卡（优先用预占卡，过期已释放则现取）──
-- Idempotent: 重复回调返回已发卡密；过期后付款仍按已付处理并尽量发卡。
create or replace function deliver_order(p_trade_order_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   orders%rowtype;
  v_card_id uuid;
  v_secret  text;
begin
  select * into v_order from orders where trade_order_id = p_trade_order_id for update;
  if not found then
    return null;
  end if;

  -- 已发卡：幂等返回原卡密
  if v_order.status = 'paid' and v_order.card_id is not null then
    select secret into v_secret from cards where id = v_order.card_id;
    return v_secret;
  end if;

  -- 有预占卡：直接标记售出 + 订单已付
  if v_order.card_id is not null then
    update cards set status = 'sold', sold_at = coalesce(sold_at, now())
      where id = v_order.card_id and order_id = v_order.id;
    select secret into v_secret from cards where id = v_order.card_id;
    update orders set status = 'paid', paid_at = now() where id = v_order.id;
    return v_secret;
  end if;

  -- 无预占卡（如已过期被释放）：现取一张未售卡（并发安全）
  select id, secret into v_card_id, v_secret
  from cards
  where product_id = v_order.product_id and status = 'unsold'
  order by created_at
  for update skip locked
  limit 1;

  if v_card_id is null then
    update orders set status = 'paid', paid_at = now() where id = v_order.id; -- 已付但缺货，待人工
    return null;
  end if;

  update cards  set status = 'sold', order_id = v_order.id, sold_at = now() where id = v_card_id;
  update orders set status = 'paid', card_id = v_card_id, paid_at = now() where id = v_order.id;
  return v_secret;
end;
$$;

-- ── Views ───────────────────────────────────────────────────────

-- Public, safe view for the landing page (no secrets). Runs as owner so it
-- can count cards without exposing the cards table to anon.
-- ⚠️ image_url 必须排在 stock 之后：线上视图是按此列序建的，
--    create or replace 只允许在末尾追加列，改中间顺序会报错。
create or replace view public_products
with (security_invoker = false) as
select
  p.id, p.name, p.description, p.price_cents, p.sort_order,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'unsold') as stock,
  p.image_url
from products p
where p.is_active = true
order by p.sort_order, p.created_at;

-- Admin view with stock + sold counts (read via service role only).
-- drop + create（而非 create or replace）：日后给 products 增列时，新列经 p.*
-- 会落在 stock 列的位置上，create or replace 会因"列改名"报错；重建可绕开。
drop view if exists product_stock;
create view product_stock
with (security_invoker = false) as
select
  p.*,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'unsold') as stock,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'sold')   as sold
from products p;

-- ── RLS ─────────────────────────────────────────────────────────
-- All writes go through the service role (server-side), which bypasses RLS.
-- Enabling RLS with no anon policies keeps cards/orders private.
alter table products enable row level security;
alter table cards    enable row level security;
alter table orders   enable row level security;
alter table articles enable row level security; -- 文章读写全走 service_role（服务端渲染/后台）

-- (no anon policies on cards/orders — they stay private)

-- Expose only the safe public view + delivery function to anon.
grant select on public_products to anon, authenticated;
grant execute on function deliver_order(text) to service_role;

-- ── service_role 授权 ────────────────────────────────────────────
-- 服务端（后台/下单/回调）全程用 service_role 读写 cards/orders/products，
-- RLS 对它不生效，这是 Supabase 的标准模型。
--
-- ⚠️ 通过 Supabase SQL Editor 运行本文件时，平台会自动把表权限授予
-- service_role，下面这段是冗余且无害的；但如果你用「数据库直连」
-- （psql / 连接串）建表，则不会触发那套自动授权，service_role 会缺权限
-- 导致后台报 "permission denied for table orders"。这段保证两种方式都能用。
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- 让今后新建的表/序列/函数也自动授权给 service_role，避免再次踩坑。
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
