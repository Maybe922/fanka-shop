import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const modulePath=process.env.PGLITE_MODULE;
test('Buyer cancellation: real route and database, no external payment or production stock',{skip:!modulePath},async t=>{
  const {context,databaseAdapter,freshDatabase,restoreHarness}=await import('./helpers/payment-harness.mjs');
  const {POST}=await import('../src/app/api/orders/[id]/cancel/route.ts');
  const {GET}=await import('../src/app/api/orders/[id]/route.ts');
  const db=await freshDatabase(modulePath);
  const user='00000000-0000-4000-a000-000000000001',other='00000000-0000-4000-a000-000000000099',product='00000000-0000-4000-a000-000000000002';
  context.db=databaseAdapter(db);context.buyer={id:user};context.wechatQuery=async()=>({paid:false,status:'WP'});
  await db.query('insert into auth.users values ($1),($2)',[user,other]);
  await db.query("insert into products(id,name,price_cents) values ($1,'cancel-test',100)",[product]);
  await db.query("insert into cards(product_id,secret) select $1,'CANCEL-TEST-'||n from generate_series(1,40)n",[product]);
  const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  let seq=0;
  async function create(method='wechat') {
    const trade='CANCEL-'+ ++seq;
    const result=await db.query("select create_order_reserved($1,$2,100,$3,null,now()+interval '20 minutes')",[product,trade,user]);
    const id=Object.values(result.rows[0])[0];
    if(method!=='wechat'){
      const tron=method==='usdt_trc20';
      await db.query('update orders set payment_method=$2 where id=$1',[id,method]);
      await db.query(`insert into usdt_payments(order_id,recipient,token,chain_id,amount_micros,rate_cny,rate_fetched_at,start_block,scanned_to,expires_at) values($1,$2,$3,$4,$5,7,now(),100,100,now()+interval '20 minutes')`,[id,tron?'TXyxwH7MWjTSXZuDUKyMfiCT7tMNLZRtKU':'0xedfbb6a7b8e93f917b73985725d02659121f5830',tron?'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t':'0x55d398326f99059ff775485246999027b3197955',tron?728126428:56,1000000+seq]);
    }
    return {id,trade};
  }
  const cancel=(id,origin='https://test.invalid')=>POST(new Request(`https://test.invalid/api/orders/${id}/cancel`,{method:'POST',headers:{origin}}),{params:Promise.resolve({id})});
  const read=id=>GET(new Request('https://test.invalid/api/orders/'+id),{params:Promise.resolve({id})});
  try {
    await t.test('migration is repeatable; only server role may cancel',async()=>{
      await db.exec(await readFile(new URL('../supabase/migrations/20261017_buyer_cancel.sql',import.meta.url),'utf8'));
      assert.equal(await scalar("select has_function_privilege('authenticated','cancel_buyer_order(uuid,uuid)','EXECUTE')"),false);
      assert.equal(await scalar("select has_function_privilege('anon','cancel_buyer_order(uuid,uuid)','EXECUTE')"),false);
      assert.equal(await scalar("select has_function_privilege('service_role','cancel_buyer_order(uuid,uuid)','EXECUTE')"),true);
    });
    const protectedOrder=await create();
    await t.test('cross-origin, anonymous and other buyers cannot cancel or release cards',async()=>{
      assert.equal((await cancel(protectedOrder.id,'https://attacker.invalid')).status,403);
      context.buyer=null; assert.equal((await cancel(protectedOrder.id)).status,401);
      context.buyer={id:other}; assert.equal((await cancel(protectedOrder.id)).status,404);
      assert.equal(await scalar('select cancel_buyer_order($1,$2)',[protectedOrder.id,other]),'not_found');
      context.buyer={id:user};assert.equal(await scalar('select status from orders where id=$1',[protectedOrder.id]),'pending');
    });
    for(const method of ['wechat','usdt_bep20','usdt_trc20'])await t.test(method+' cancellation is idempotent, retains history and releases only own reservation',async()=>{
      const {id}=await create(method);
      const card=await scalar('select card_id from orders where id=$1',[id]);
      assert.equal((await cancel(id)).status,200);assert.equal((await cancel(id)).status,200);
      assert.equal(await scalar('select status from cards where id=$1',[card]),'unsold');
      assert.equal(await scalar('select order_id from cards where id=$1',[card]),null);
      assert.equal(await scalar('select card_id from orders where id=$1',[id]),null);
      const payload=await (await read(id)).json();assert.ok(payload.cancelledAt);assert.equal(payload.status,'expired');assert.equal(payload.secret,null);
      assert.equal(await scalar('select status from orders where id=$1',[protectedOrder.id]),'pending');
      if(method!=='wechat')assert.equal(await scalar('select state from usdt_payments where order_id=$1',[id]),'watching');
    });
    await t.test('WeChat unknown or paid provider result cannot cancel',async()=>{
      const {id}=await create();
      context.wechatQuery=async()=>({paid:false,status:null});assert.equal((await cancel(id)).status,503);
      context.wechatQuery=async()=>({paid:true,status:'OD'});assert.equal((await cancel(id)).status,409);
      assert.equal(await scalar('select status from orders where id=$1',[id]),'pending');
      context.wechatQuery=async()=>({paid:false,status:'WP'});
    });
    await t.test('delivery wins between WeChat precheck and cancel transaction',async()=>{
      const {id,trade}=await create();
      context.wechatQuery=async()=>{await db.query('select deliver_order($1)',[trade]);return {paid:false,status:'WP'};};
      assert.equal((await cancel(id)).status,409);
      const card=await scalar('select card_id from orders where id=$1',[id]);assert.equal(await scalar('select status from cards where id=$1',[card]),'sold');
      assert.equal(await scalar('select cancelled_at from orders where id=$1',[id]),null);
      context.wechatQuery=async()=>({paid:false,status:'WP'});
    });
    await t.test('review, paid and expired orders are not cancellable',async()=>{
      const {id}=await create('usdt_bep20');await db.query("update usdt_payments set state='review' where order_id=$1",[id]);assert.equal((await cancel(id)).status,409);
      const paid=await create();await db.query('select deliver_order($1)',[paid.trade]);assert.equal((await cancel(paid.id)).status,409);
      const expired=await create();await db.query("update orders set expires_at=now()-interval '1 second' where id=$1",[expired.id]);assert.equal((await cancel(expired.id)).status,409);
    });
    for(const method of ['wechat','usdt_bep20','usdt_trc20'])await t.test(method+' already-sent payment still delivers after cancellation, once only',async()=>{
      const {id,trade}=await create(method);assert.equal((await cancel(id)).status,200);
      if(method==='wechat')await db.query('select deliver_order($1)',[trade]);
      else {
        const q=(await db.query('select * from usdt_payments where order_id=$1',[id])).rows[0];
        const sql='select settle_usdt_payment($1,$2,0,101,$3,$4,$5,$6,$7)';
        const args=[id,'0x'+seq.toString(16).padStart(64,'0'),'0x'+'b'.repeat(64),new Date(new Date(q.created_at).getTime()+1000).toISOString(),q.recipient,q.token,(BigInt(q.amount_micros)*(method==='usdt_bep20'?1000000000000n:1n)).toString()];
        assert.equal(Object.values((await db.query(sql,args)).rows[0])[0],true);
        await db.query(sql,args);
      }
      assert.equal((await (await read(id)).json()).status,'paid');
      assert.equal(await scalar("select count(*)::int from cards where order_id=$1 and status='sold'",[id]),1);
    });
  } finally {await db.close();restoreHarness();}
});
