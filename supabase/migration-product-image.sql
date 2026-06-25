-- ┌─────────────────────────────────────────────────────────────┐
-- │ 迁移：给商品增加「图片链接」字段 image_url                       │
-- │ Supabase SQL Editor 整段粘贴运行；幂等。                         │
-- └─────────────────────────────────────────────────────────────┘

alter table products add column if not exists image_url text;

-- 前台公开视图：追加 image_url（create or replace 末尾加列，保留 anon 授权）
create or replace view public_products
with (security_invoker = false) as
select
  p.id, p.name, p.description, p.price_cents, p.sort_order,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'unsold') as stock,
  p.image_url
from products p
where p.is_active = true
order by p.sort_order, p.created_at;

-- 后台视图：drop+create（p.* 含新列，位置在中间，故重建）
drop view if exists product_stock;
create view product_stock
with (security_invoker = false) as
select
  p.*,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'unsold') as stock,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'sold')   as sold
from products p;
