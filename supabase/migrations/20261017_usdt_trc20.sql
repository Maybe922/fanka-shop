-- Add TRON mainnet alongside existing BEP20; preserve all existing orders and receipts.
begin;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('wechat','usdt_bep20','usdt_trc20'));
alter table public.usdt_payments drop constraint if exists usdt_payments_recipient_check;
alter table public.usdt_payments drop constraint if exists usdt_payments_token_check;
alter table public.usdt_payments drop constraint if exists usdt_payments_chain_id_check;
alter table public.usdt_payments drop constraint if exists usdt_network_check;
alter table public.usdt_payments add constraint usdt_network_check check (
  (chain_id = 56 and recipient ~ '^0x[0-9a-f]{40}$' and token = '0x55d398326f99059ff775485246999027b3197955') or
  (chain_id = 728126428 and recipient ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' and token = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
);
alter table public.usdt_receipts add column if not exists chain_id integer not null default 56;
alter table public.usdt_receipts drop constraint if exists usdt_receipts_chain_id_check;
alter table public.usdt_receipts add constraint usdt_receipts_chain_id_check check (chain_id in (56,728126428));
alter table public.usdt_receipts drop constraint if exists usdt_receipts_pkey;
alter table public.usdt_receipts add primary key(chain_id, tx_hash, log_index);
create or replace function public.create_usdt_trc20_order(
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
     or p_recipient is null or p_recipient !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' then
    raise exception 'INVALID_USDT_QUOTE';
  end if;
  -- 锁定当前商品价格，不能使用客户端金额，也不接受已经过时的商品价格。
  perform 1 from products where id = p_product_id and is_active
    and not contact_only and price_cents = p_amount_cents and price_cents > 0 for share;
  if not found then raise exception 'PRODUCT_CHANGED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('usdt:' || p_recipient, 0));
  v_base := floor(p_amount_cents::numeric / p_rate_cny)::bigint * 10000;
  select v_base + n into v_amount from generate_series(1,9999) n
    where not exists (select 1 from usdt_payments where recipient = p_recipient and amount_micros = v_base + n)
    order by random() limit 1;
  if v_amount is null then raise exception 'USDT_QUOTE_CAPACITY'; end if;
  v_id := create_order_reserved_limited(p_product_id, p_trade_order_id, p_amount_cents,
    p_user_id, p_email, v_expiry, p_ip);
  if v_id is null then return null; end if;
  update orders set payment_method = 'usdt_trc20' where id = v_id;
  insert into usdt_payments(order_id, recipient, token, chain_id, amount_micros, rate_cny,
    rate_fetched_at, start_block, scanned_to, expires_at)
  values(v_id, p_recipient, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 728126428, v_amount,
    p_rate_cny, p_rate_fetched_at, p_start_block, p_start_block, v_expiry);
  return v_id;
end; $$;

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
    or p_amount_atomic is distinct from (v_payment.amount_micros::numeric * case when v_payment.chain_id = 56 then 1000000000000 else 1 end)::text
    or p_block_number <= v_payment.start_block or p_block_number is null
    or p_block_time < date_trunc('second', v_payment.created_at) or p_block_time is null
    or p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-f]{64}$'
    or p_block_hash is null or p_block_hash !~ '^0x[0-9a-f]{64}$'
    or p_log_index is null or p_log_index < 0 then
    raise exception 'PAYMENT_MISMATCH';
  end if;
  select trade_order_id into v_trade from orders
    where id = p_order_id and payment_method = case when v_payment.chain_id = 56 then 'usdt_bep20' else 'usdt_trc20' end for update;
  if not found then raise exception 'PAYMENT_METHOD_MISMATCH'; end if;
  insert into usdt_receipts(chain_id, tx_hash, log_index, order_id, block_number, block_hash, block_time)
    values(v_payment.chain_id, p_tx_hash, p_log_index, p_order_id, p_block_number, p_block_hash, p_block_time);
  if p_block_time > v_payment.expires_at then
    update usdt_payments set state = 'review', checked_at = now() where order_id = p_order_id;
    return false;
  end if;
  perform deliver_order(v_trade);
  update usdt_payments set state = 'paid', checked_at = now() where order_id = p_order_id;
  return true;
end; $$;

revoke execute on function public.create_usdt_trc20_order(uuid,text,integer,uuid,text,text,text,numeric,timestamptz,bigint) from public, anon, authenticated;
grant execute on function public.create_usdt_trc20_order(uuid,text,integer,uuid,text,text,text,numeric,timestamptz,bigint) to service_role;
revoke execute on function public.settle_usdt_payment(uuid,text,integer,bigint,text,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.settle_usdt_payment(uuid,text,integer,bigint,text,timestamptz,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
