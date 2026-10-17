-- USDT BEP20 收款：在 Supabase SQL Editor 一次执行。保留现有订单、库存和微信支付。
begin;

alter table public.orders add column if not exists payment_method text not null default 'wechat'
  check (payment_method in ('wechat', 'usdt_bep20'));

create table if not exists public.usdt_payments (
  order_id uuid primary key references public.orders(id),
  recipient text not null check (recipient ~ '^0x[0-9a-f]{40}$'),
  token text not null check (token = '0x55d398326f99059ff775485246999027b3197955'),
  chain_id integer not null default 56 check (chain_id = 56),
  amount_micros bigint not null check (amount_micros > 0),
  rate_cny numeric(20,10) not null check (rate_cny between 1 and 100),
  rate_fetched_at timestamptz not null,
  start_block bigint not null check (start_block > 0),
  scanned_to bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  state text not null default 'watching' check (state in ('watching','paid','expired','review')),
  checked_at timestamptz,
  -- 永久不复用同地址的精确金额，防止旧订单的延迟付款匹配到新订单。
  unique(recipient, amount_micros)
);
create index if not exists usdt_watch_queue on public.usdt_payments(state, checked_at nulls first);

create table if not exists public.usdt_receipts (
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer not null check (log_index >= 0),
  order_id uuid not null unique references public.usdt_payments(order_id),
  block_number bigint not null,
  block_hash text not null,
  block_time timestamptz not null,
  received_at timestamptz not null default now(),
  primary key(tx_hash, log_index)
);
alter table public.usdt_payments enable row level security;
alter table public.usdt_receipts enable row level security;
revoke all on public.usdt_payments, public.usdt_receipts from public, anon, authenticated;
grant all on public.usdt_payments, public.usdt_receipts to service_role;

create or replace function public.create_usdt_order(
  p_product_id uuid, p_trade_order_id text, p_amount_cents integer,
  p_user_id uuid, p_email text, p_ip text,
  p_recipient text, p_rate_cny numeric, p_rate_fetched_at timestamptz, p_start_block bigint
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_base bigint;
  v_amount bigint;
  v_expiry timestamptz := now() + interval '20 minutes';
begin
  if p_rate_cny not between 1 and 100 or p_rate_cny is null
     or p_rate_fetched_at < now() - interval '90 seconds'
     or p_rate_fetched_at > now() + interval '15 seconds'
     or p_rate_fetched_at is null or p_start_block is null or p_start_block <= 0
     or p_recipient is null or lower(p_recipient) !~ '^0x[0-9a-f]{40}$' then
    raise exception 'INVALID_USDT_QUOTE';
  end if;
  -- 锁定当前商品价格，不能使用客户端金额，也不接受已经过时的商品价格。
  perform 1 from products where id = p_product_id and is_active
    and not contact_only and price_cents = p_amount_cents and price_cents > 0 for share;
  if not found then raise exception 'PRODUCT_CHANGED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('usdt:' || lower(p_recipient), 0));
  v_base := floor(p_amount_cents::numeric / p_rate_cny)::bigint * 10000;
  select v_base + n into v_amount from generate_series(1,9999) n
    where not exists (select 1 from usdt_payments where recipient = lower(p_recipient) and amount_micros = v_base + n)
    order by random() limit 1;
  if v_amount is null then raise exception 'USDT_QUOTE_CAPACITY'; end if;
  v_id := create_order_reserved_limited(p_product_id, p_trade_order_id, p_amount_cents,
    p_user_id, p_email, v_expiry, p_ip);
  if v_id is null then return null; end if;
  update orders set payment_method = 'usdt_bep20' where id = v_id;
  insert into usdt_payments(order_id, recipient, token, amount_micros, rate_cny,
    rate_fetched_at, start_block, scanned_to, expires_at)
  values(v_id, lower(p_recipient), '0x55d398326f99059ff775485246999027b3197955', v_amount,
    p_rate_cny, p_rate_fetched_at, p_start_block, p_start_block, v_expiry);
  return v_id;
end; $$;

-- 仅由服务器在核实 finalized 区块、成功回执和 Transfer 事件之后调用。
-- 回执入账与发卡同一事务；重试不会重复发卡，也不能复用一笔链上付款。
create or replace function public.settle_usdt_payment(
  p_order_id uuid, p_tx_hash text, p_log_index integer, p_block_number bigint,
  p_block_hash text, p_block_time timestamptz, p_recipient text, p_token text,
  p_amount_atomic text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_payment usdt_payments%rowtype;
  v_trade text;
begin
  select * into v_payment from usdt_payments where order_id = p_order_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.state = 'paid' then return true; end if;
  if v_payment.state = 'review' then return false; end if;
  if p_recipient is distinct from v_payment.recipient or p_token is distinct from v_payment.token
    or p_amount_atomic is distinct from (v_payment.amount_micros::numeric * 1000000000000)::text
    or p_block_number <= v_payment.start_block or p_block_number is null
    or p_block_time < date_trunc('second', v_payment.created_at) or p_block_time is null
    or p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-f]{64}$'
    or p_block_hash is null or p_block_hash !~ '^0x[0-9a-f]{64}$'
    or p_log_index is null or p_log_index < 0 then
    raise exception 'PAYMENT_MISMATCH';
  end if;
  select trade_order_id into v_trade from orders
    where id = p_order_id and payment_method = 'usdt_bep20' for update;
  if not found then raise exception 'PAYMENT_METHOD_MISMATCH'; end if;
  insert into usdt_receipts(tx_hash, log_index, order_id, block_number, block_hash, block_time)
    values(p_tx_hash, p_log_index, p_order_id, p_block_number, p_block_hash, p_block_time);
  if p_block_time > v_payment.expires_at then
    update usdt_payments set state = 'review', checked_at = now() where order_id = p_order_id;
    return false;
  end if;
  perform deliver_order(v_trade);
  update usdt_payments set state = 'paid', checked_at = now() where order_id = p_order_id;
  return true;
end; $$;

-- 与发卡使用相同的订单 → 卡密锁顺序，防止回收过期库存与到账发卡并发。
create or replace function public.expire_stale_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_count integer := 0;
begin
  for v_order in select * from orders where status = 'pending' and expires_at < now()
    for update skip locked
  loop
    update cards set status = 'unsold', order_id = null
      where order_id = v_order.id and status = 'reserved';
    update orders set status = 'expired', card_id = null where id = v_order.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

revoke execute on function public.create_usdt_order(uuid,text,integer,uuid,text,text,text,numeric,timestamptz,bigint) from public, anon, authenticated;
revoke execute on function public.settle_usdt_payment(uuid,text,integer,bigint,text,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.create_usdt_order(uuid,text,integer,uuid,text,text,text,numeric,timestamptz,bigint) to service_role;
grant execute on function public.settle_usdt_payment(uuid,text,integer,bigint,text,timestamptz,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
