-- 在 Supabase SQL Editor 执行。只增加下单函数，不修改现有订单或卡密。
begin;

create or replace function public.create_order_reserved_limited(
  p_product_id uuid,
  p_trade_order_id text,
  p_amount_cents integer,
  p_user_id uuid,
  p_email text,
  p_expires_at timestamptz,
  p_ip text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_count integer;
begin
  if p_user_id is null then
    raise exception 'ORDER_USER_REQUIRED';
  end if;

  -- 同 IP、同账号的请求依次执行；锁一直持有到预占库存和记录 IP 的事务结束。
  if p_ip is not null then
    perform pg_advisory_xact_lock(hashtextextended('order-ip:' || p_ip, 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('order-user:' || p_user_id::text, 0));

  select count(*) into v_count from orders
  where user_id = p_user_id and status = 'pending';
  if v_count >= 3 then
    raise exception 'ORDER_LIMIT_PENDING';
  end if;

  if p_ip is not null then
    select count(*) into v_count from orders
    where ip = p_ip and status = 'pending';
    if v_count >= 6 then
      raise exception 'ORDER_LIMIT_IP';
    end if;
  end if;

  select count(*) into v_count from orders
  where user_id = p_user_id and created_at >= now() - interval '1 hour';
  if v_count >= 10 then
    raise exception 'ORDER_LIMIT_HOURLY';
  end if;

  v_order_id := create_order_reserved(
    p_product_id, p_trade_order_id, p_amount_cents,
    p_user_id, p_email, p_expires_at
  );
  if v_order_id is not null then
    update orders set ip = p_ip where id = v_order_id;
  end if;
  return v_order_id;
end;
$$;

revoke execute on function public.create_order_reserved_limited(uuid, text, integer, uuid, text, timestamptz, text)
from public, anon, authenticated;
grant execute on function public.create_order_reserved_limited(uuid, text, integer, uuid, text, timestamptz, text)
to service_role;

notify pgrst, 'reload schema';
commit;
