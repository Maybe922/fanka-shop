-- 只公开每个商品的已付款订单数量，不公开订单或买家信息。
begin;

create index if not exists idx_orders_paid_product
on public.orders (product_id) where status = 'paid';

-- 新列必须追加在现有视图列的末尾。
create or replace view public.public_products
with (security_invoker = false) as
select
  p.id, p.name, p.description, p.price_cents, p.sort_order,
  (select count(*) from public.cards c where c.product_id = p.id and c.status = 'unsold') as stock,
  p.image_url,
  p.contact_only,
  (select count(*) from public.orders o where o.product_id = p.id and o.status = 'paid') as sold_count
from public.products p
where p.is_active = true
order by p.sort_order, p.created_at;

grant select on public.public_products to anon, authenticated;
notify pgrst, 'reload schema';
commit;
