import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Integration suite: PGLITE_MODULE must point to an isolated @electric-sql/pglite installation.
const modulePath = process.env.PGLITE_MODULE;
test('BEP20 migration and atomic settlement (isolated PostgreSQL)', { skip: !modulePath }, async t => {
  const { PGlite } = await import(modulePath);
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
  const base = await readFile(new URL('../supabase/schema.sql', import.meta.url),'utf8');
  await db.exec(base.replace('create extension if not exists pgcrypto;', ''));
  await db.exec(await readFile(new URL('../supabase/migrations/20260929_atomic_order_limits.sql', import.meta.url),'utf8'));
  const migration = await readFile(new URL('../supabase/migrations/20261017_usdt_bep20.sql', import.meta.url),'utf8');
  await db.exec(migration);
  await db.exec(migration); // Safe to rerun.
  const tronMigration = await readFile(new URL('../supabase/migrations/20261017_usdt_trc20.sql', import.meta.url),'utf8');
  await db.exec(tronMigration); await db.exec(tronMigration);
  const user = '00000000-0000-4000-a000-000000000001';
  const product = '00000000-0000-4000-a000-000000000002';
  const recipient = '0xaf70d68c0bae1555411d99109b402d7457df2cab';
  await db.query('insert into auth.users values ($1)',[user]);
  await db.query("insert into products(id,name,price_cents) values ($1,'test',13000)",[product]);
  await db.query("insert into cards(product_id,secret) select $1, 'isolated-test-' || n from generate_series(1,20) n",[product]);
  let seq = 0;
  async function create(rate='7', price=13000) {
    const r = await db.query("select create_usdt_order($1,$2,$3,$4,'test@example.invalid',null,$5,$6,now(),100) id",[product,`TEST-${++seq}`,price,user,recipient,rate]);
    return r.rows[0].id;
  }
  async function quote(id) { return (await db.query('select * from usdt_payments where order_id=$1',[id])).rows[0]; }
  async function settle(id, tx='a', time, amount) {
    const q = await quote(id);
    return db.query("select settle_usdt_payment($1,$2,0,101,$3,$4,$5,$6,$7) paid",[id,'0x'+tx.repeat(64),'0x'+'b'.repeat(64),time ?? new Date(new Date(q.created_at).getTime()+1000).toISOString(),recipient,q.token,amount ?? (BigInt(q.amount_micros)*1000000000000n).toString()]);
  }
  await t.test('RPCs and payment tables are inaccessible to anon/authenticated',async()=>{
    const r=await db.query("select has_function_privilege('anon','public.create_usdt_order(uuid,text,integer,uuid,text,text,text,numeric,timestamptz,bigint)','EXECUTE') create_allowed, has_function_privilege('authenticated','public.settle_usdt_payment(uuid,text,integer,bigint,text,timestamptz,text,text,text)','EXECUTE') settle_allowed, has_table_privilege('anon','usdt_payments','SELECT') read_allowed");
    assert.deepEqual(r.rows[0],{create_allowed:false,settle_allowed:false,read_allowed:false});
  });
  await t.test('price tampering and invalid rates roll back without reserving stock',async()=>{
    for (const [rate, price] of [['0',13000],['7',1]]) await assert.rejects(create(rate,price));
    assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
  });
  const first=await create(), second=await create();
  await t.test('same-price orders get permanent distinct amounts with locked rates',async()=>{
    const a=await quote(first),b=await quote(second);
    assert.notEqual(a.amount_micros,b.amount_micros);
    assert.ok(Math.abs(Number(a.amount_micros)/1e6-130/7)<0.01);
    assert.equal(Number(a.rate_cny),7);
    assert.equal((await db.query("select count(*)::int n from cards where status='reserved'")).rows[0].n,2);
  });
  await t.test('wrong amount cannot settle',async()=>{
    await assert.rejects(settle(first,'a',undefined,'1'),/PAYMENT_MISMATCH/);
    assert.equal((await db.query('select status from orders where id=$1',[first])).rows[0].status,'pending');
  });
  await t.test('valid receipt atomically delivers one card; duplicate retries are idempotent',async()=>{
    assert.equal((await settle(first)).rows[0].paid,true);
    assert.equal((await settle(first)).rows[0].paid,true);
    assert.equal((await db.query("select count(*)::int n from cards where status='sold'")).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from usdt_receipts')).rows[0].n,1);
  });
  await t.test('one chain event cannot pay two orders',async()=>{
    await assert.rejects(settle(second),/duplicate key/);
    assert.equal((await db.query('select status from orders where id=$1',[second])).rows[0].status,'pending');
  });
  await t.test('late arrival is flagged for review, never automatically delivers',async()=>{
    const q=await quote(second);
    assert.equal((await settle(second,'c',new Date(new Date(q.expires_at).getTime()+1000).toISOString())).rows[0].paid,false);
    assert.equal((await quote(second)).state,'review');
    assert.equal((await db.query("select count(*)::int n from cards where status='sold'")).rows[0].n,1);
  });
  const third=await create();
  await t.test('payment mined in time can settle after inventory expiry',async()=>{
    const q=await quote(third);
    await db.query("update orders set expires_at=now()-interval '1 second' where id=$1",[third]);
    await db.query('select expire_stale_orders()');
    assert.equal((await db.query('select status from orders where id=$1',[third])).rows[0].status,'expired');
    assert.equal((await settle(third,'d',new Date(new Date(q.created_at).getTime()+1000).toISOString())).rows[0].paid,true);
    assert.equal((await db.query("select count(*)::int n from cards where status='sold'")).rows[0].n,2);
  });
  await t.test('old WeChat order creation and delivery still work',async()=>{
    const r=await db.query("select create_order_reserved_limited($1,'WECHAT',13000,$2,null,now()+interval '20 minutes',null) id",[product,user]);
    const id=r.rows[0].id;
    assert.equal((await db.query('select payment_method from orders where id=$1',[id])).rows[0].payment_method,'wechat');
    await db.query("select deliver_order('WECHAT')");
    assert.equal((await db.query('select status from orders where id=$1',[id])).rows[0].status,'paid');
  });
  await t.test('TRON quote, network isolation, 6-decimal amount and idempotent delivery',async()=>{
    const address='TRxrRkp3adSyUtQK1NYVA9VJVds1r4fhWb';
    const r=await db.query("select create_usdt_trc20_order($1,'TRON',13000,$2,null,null,$3,7,now(),100) id",[product,user,address]);
    const id=r.rows[0].id, q=await quote(id);
    assert.equal(q.chain_id,728126428); assert.equal(q.recipient,address);
    assert.equal(q.token,'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    assert.equal((await db.query('select payment_method from orders where id=$1',[id])).rows[0].payment_method,'usdt_trc20');
    const args=[id,'0x'+'e'.repeat(64),'0x'+'f'.repeat(64),new Date(new Date(q.created_at).getTime()+1000).toISOString(),address,q.token,String(q.amount_micros)];
    const sql="select settle_usdt_payment($1,$2,0,101,$3,$4,$5,$6,$7) paid";
    await assert.rejects(db.query(sql,[...args.slice(0,6),(BigInt(q.amount_micros)*1000000000000n).toString()]),/PAYMENT_MISMATCH/);
    await assert.rejects(db.query(sql,[...args.slice(0,5),'0x55d398326f99059ff775485246999027b3197955',args[6]]),/PAYMENT_MISMATCH/);
    assert.equal((await db.query(sql,args)).rows[0].paid,true);
    assert.equal((await db.query(sql,args)).rows[0].paid,true);
    assert.equal((await db.query('select chain_id from usdt_receipts where order_id=$1',[id])).rows[0].chain_id,728126428);
    const permissions=await db.query("select has_function_privilege('anon','public.create_usdt_trc20_order(uuid,text,integer,uuid,text,text,text,numeric,timestamptz,bigint)','EXECUTE') allowed");
    assert.equal(permissions.rows[0].allowed,false);
  });
  await db.close();
});
