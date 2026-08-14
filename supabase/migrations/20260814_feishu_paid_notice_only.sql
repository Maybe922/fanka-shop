-- 飞书订单通知改为仅在支付成功后发送，并为并发回调增加带租约的原子认领。
-- 幂等：重复执行不会破坏现有数据。

alter table orders
  add column if not exists feishu_paid_notice_claimed_at timestamptz;
alter table orders
  add column if not exists feishu_paid_notice_sent_at timestamptz;

-- 上线前已经完成的历史订单不补发，避免突然向运营群灌入旧订单。
update orders
set feishu_paid_notice_sent_at = coalesce(paid_at, now())
where status = 'paid'
  and feishu_paid_notice_sent_at is null;

create or replace function claim_feishu_paid_notice(p_trade_order_id text)
returns table (
  order_id       uuid,
  trade_order_id text,
  email          text,
  amount_cents   integer,
  paid_at        timestamptz,
  product_name   text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    update orders o
    set feishu_paid_notice_claimed_at = now()
    where o.trade_order_id = p_trade_order_id
      and o.status = 'paid'
      and o.feishu_paid_notice_sent_at is null
      and (
        o.feishu_paid_notice_claimed_at is null
        or o.feishu_paid_notice_claimed_at < now() - interval '5 minutes'
      )
    returning o.id, o.trade_order_id, o.email, o.amount_cents,
              o.paid_at, o.product_id
  )
  select c.id, c.trade_order_id, c.email, c.amount_cents,
         coalesce(c.paid_at, now()), p.name
  from claimed c
  join products p on p.id = c.product_id;
end;
$$;

revoke execute on function claim_feishu_paid_notice(text)
  from public, anon, authenticated;
grant execute on function claim_feishu_paid_notice(text)
  to service_role;
