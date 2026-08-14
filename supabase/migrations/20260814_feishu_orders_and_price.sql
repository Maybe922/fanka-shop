-- 飞书订单通知与远程改价上线前执行一次。
-- 幂等：重复执行不会破坏现有数据。

create table if not exists product_price_audit (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete restrict,
  old_price_cents integer not null check (old_price_cents >= 0),
  new_price_cents integer not null check (new_price_cents >= 0),
  source          text not null default 'feishu' check (source in ('feishu', 'admin')),
  actor_ref       text not null,
  message_id      text not null,
  created_at      timestamptz not null default now(),
  unique (source, message_id)
);

create index if not exists idx_product_price_audit_product_created
  on product_price_audit (product_id, created_at desc);

alter table product_price_audit enable row level security;

create or replace function update_product_price_from_bot(
  p_product_id      uuid,
  p_new_price_cents integer,
  p_message_id      text,
  p_actor_ref       text
)
returns table (
  product_name     text,
  old_price_cents  integer,
  new_price_cents  integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name      text;
  v_old_price integer;
begin
  if p_new_price_cents < 0 or p_new_price_cents > 10000000 then
    raise exception 'price out of range';
  end if;
  if btrim(coalesce(p_message_id, '')) = '' or btrim(coalesce(p_actor_ref, '')) = '' then
    raise exception 'audit context required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 1));

  select name, price_cents into v_name, v_old_price
  from products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'product not found';
  end if;

  if v_old_price <> p_new_price_cents then
    update products
    set price_cents = p_new_price_cents
    where id = p_product_id;

    insert into product_price_audit (
      product_id, old_price_cents, new_price_cents,
      source, actor_ref, message_id
    ) values (
      p_product_id, v_old_price, p_new_price_cents,
      'feishu', p_actor_ref, p_message_id
    );
  end if;

  return query
  select v_name, v_old_price, p_new_price_cents;
end;
$$;

revoke execute on function update_product_price_from_bot(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function update_product_price_from_bot(uuid, integer, text, text)
  to service_role;
grant all on product_price_audit to service_role;
