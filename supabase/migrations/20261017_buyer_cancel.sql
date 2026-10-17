-- 买家取消只释放预占，不删除交易记录，也不关闭延迟到账核验。
begin;
alter table public.orders add column if not exists cancelled_at timestamptz;

create or replace function public.cancel_buyer_order(p_order_id uuid, p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_payment_state text;
begin
  -- 和链上入账保持 payment → order → card 锁顺序。
  select state into v_payment_state from usdt_payments where order_id = p_order_id for update;
  select * into v_order from orders where id = p_order_id for update;
  if not found or p_user_id is null or v_order.user_id is distinct from p_user_id then
    return 'not_found';
  end if;
  if v_order.status = 'paid' or v_payment_state = 'paid' then return 'paid'; end if;
  if v_payment_state = 'review' then return 'review'; end if;
  if v_order.cancelled_at is not null then return 'cancelled'; end if;
  if v_order.status <> 'pending' or v_order.expires_at <= now() then return 'expired'; end if;
  update cards set status = 'unsold', order_id = null
    where order_id = v_order.id and status = 'reserved';
  update orders set status = 'expired', card_id = null, cancelled_at = now() where id = v_order.id;
  -- 保留 USDT 原始报价时限与 watching 状态，避免漏掉已发出、尚未确认的转账。
  -- 微信回调及主动查单仍可将订单改为已付，到账优先于取消标记。
  return 'cancelled';
end; $$;
revoke execute on function public.cancel_buyer_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.cancel_buyer_order(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
