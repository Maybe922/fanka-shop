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
  price_cents integer not null check (price_cents >= 0), -- 价格（分）
  is_active   boolean not null default true,             -- 是否上架
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists cards (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  secret     text not null,                                -- 卡密内容
  status     text not null default 'unsold' check (status in ('unsold','sold')),
  order_id   uuid,
  sold_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products(id),
  trade_order_id text not null unique,                     -- 我方订单号（发给虎皮椒）
  amount_cents   integer not null,
  status         text not null default 'pending' check (status in ('pending','paid')),
  card_id        uuid references cards(id),                -- 发出的卡密
  contact        text,
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_cards_product_status on cards (product_id, status);
create index if not exists idx_orders_created on orders (created_at desc);

-- ── Atomic delivery: mark paid + assign one unsold card ─────────
-- Idempotent: a repeated callback returns the already-issued card.
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

  -- already delivered
  if v_order.card_id is not null then
    select secret into v_secret from cards where id = v_order.card_id;
    return v_secret;
  end if;

  -- take one unsold card for this product (concurrency-safe)
  select id, secret into v_card_id, v_secret
  from cards
  where product_id = v_order.product_id and status = 'unsold'
  order by created_at
  for update skip locked
  limit 1;

  if v_card_id is null then
    -- paid but out of stock: mark paid, leave card null for manual handling
    update orders set status = 'paid', paid_at = now() where id = v_order.id;
    return null;
  end if;

  update cards
    set status = 'sold', order_id = v_order.id, sold_at = now()
    where id = v_card_id;
  update orders
    set status = 'paid', card_id = v_card_id, paid_at = now()
    where id = v_order.id;

  return v_secret;
end;
$$;

-- ── Views ───────────────────────────────────────────────────────

-- Public, safe view for the landing page (no secrets). Runs as owner so it
-- can count cards without exposing the cards table to anon.
create or replace view public_products
with (security_invoker = false) as
select
  p.id, p.name, p.description, p.price_cents, p.sort_order,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'unsold') as stock
from products p
where p.is_active = true
order by p.sort_order, p.created_at;

-- Admin view with stock + sold counts (read via service role only).
create or replace view product_stock
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

-- (no anon policies on cards/orders — they stay private)

-- Expose only the safe public view + delivery function to anon.
grant select on public_products to anon, authenticated;
grant execute on function deliver_order(text) to service_role;
