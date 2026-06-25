-- ┌─────────────────────────────────────────────────────────────┐
-- │ 迁移：给商品增加「使用说明 / 教程」字段                          │
-- │ 在 Supabase 控制台 → SQL Editor → New query 里整段粘贴运行。     │
-- │ 幂等，可重复执行。                                              │
-- └─────────────────────────────────────────────────────────────┘

-- 1) 给 products 增加 usage_notes 字段
alter table products add column if not exists usage_notes text;

-- 2) 重建后台库存视图，让它带上新字段。
--    用 drop + create 而非 create or replace —— 新列经 p.* 落在 stock 列
--    的位置上，create or replace 会因"列改名"报错，drop 重建可绕开。
drop view if exists product_stock;
create view product_stock
with (security_invoker = false) as
select
  p.*,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'unsold') as stock,
  (select count(*) from cards c where c.product_id = p.id and c.status = 'sold')   as sold
from products p;
