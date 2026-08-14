-- 飞书远程补货上线前执行一次。
-- 幂等：重复执行不会破坏现有数据。

create table if not exists bot_events (
  provider   text not null check (provider in ('feishu','telegram')),
  message_id text not null,
  event_id   text,
  status     text not null default 'processing'
             check (status in ('processing','completed','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, message_id)
);

create index if not exists idx_bot_events_created on bot_events (created_at);
alter table bot_events enable row level security;

create or replace function add_cards_unique(
  p_product_id uuid,
  p_secrets    text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  with cleaned as (
    select distinct btrim(secret) as secret
    from unnest(p_secrets) as input(secret)
    where btrim(secret) <> ''
  ), inserted as (
    insert into cards (product_id, secret)
    select p_product_id, cleaned.secret
    from cleaned
    where not exists (
      select 1
      from cards existing
      where existing.product_id = p_product_id
        and existing.secret = cleaned.secret
    )
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke execute on function create_order_reserved(uuid, text, integer, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function cancel_order(uuid) from public, anon, authenticated;
revoke execute on function expire_stale_orders() from public, anon, authenticated;
revoke execute on function deliver_order(text) from public, anon, authenticated;
revoke execute on function add_cards_unique(uuid, text[]) from public, anon, authenticated;

grant execute on function create_order_reserved(uuid, text, integer, uuid, text, timestamptz) to service_role;
grant execute on function cancel_order(uuid) to service_role;
grant execute on function expire_stale_orders() to service_role;
grant execute on function deliver_order(text) to service_role;
grant execute on function add_cards_unique(uuid, text[]) to service_role;

grant all on bot_events to service_role;
