// Test-only adapter: execute the real application routes against an isolated PostgreSQL
// database. Chain/FX HTTP and notification transports are replaced; no real network,
// production credentials, production orders, inventory or messages are used.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export const context = { db: null, buyer: null, notices: [], fetch: null };
const key = '__fankaIsolatedPaymentHarness';
globalThis[key] = context;
const root = resolve(import.meta.dirname, '../..');
const source = (text) => ({url:'data:text/javascript,'+encodeURIComponent(text), shortCircuit:true});
const bind = `const ctx=globalThis.${key};`;
export const hooks = registerHooks({resolve(specifier, parent, next) {
 if(specifier==='server-only')return source('export {};');
 if(specifier==='@/lib/supabase/server')return source(bind+'export const createServiceClient=()=>ctx.db;');
 if(specifier==='@/lib/supabase/auth-server')return source(bind+'export const getBuyer=async()=>ctx.buyer;');
 if(specifier==='@/lib/env')return source('export const publicEnv={siteUrl:"https://test.invalid"};');
 if(specifier==='@/lib/xunhupay')return source('export const createXunhuOrder=async()=>{throw Error("Unexpected WeChat call")};export const queryXunhuOrder=async(...args)=>{const ctx=globalThis.__fankaIsolatedPaymentHarness;if(!ctx.wechatQuery)throw Error("Unexpected WeChat call");return ctx.wechatQuery(...args);};');
 if(specifier==='@/lib/paid-order-notice')return source(bind+'export const notifyFeishuPaidOrderIfNeeded=async(...args)=>ctx.notices.push(["paid",args[1]]);');
 if(specifier==='@/lib/alert')return source(bind+'export const notifyStockOutIfNeeded=async(...args)=>ctx.notices.push(["stockout",args[1]]);export const notifyProductSoldOutIfNeeded=async(...args)=>ctx.notices.push(["product",args[1]]);');
 if(specifier==='next/server')return source('export const after=()=>{};');
 if(specifier.startsWith('@/'))return {url:pathToFileURL(resolve(root,'src',specifier.slice(2)+'.ts')).href,shortCircuit:true};
 if(specifier==='./core' && parent.parentURL?.includes('/src/lib/'))return {url:new URL('./core.ts',parent.parentURL).href,shortCircuit:true};
 return next(specifier,parent);
}});
const realFetch=globalThis.fetch;
globalThis.fetch=(...args)=>{if(!context.fetch)throw Error('Network disabled in payment tests');return context.fetch(...args);};
export function restoreHarness(){hooks.deregister();globalThis.fetch=realFetch;delete globalThis[key];}
const ident=s=>{if(!/^[a-z_][a-z0-9_]*$/.test(s))throw Error('Unsafe test identifier');return '"'+s+'"';};
export function databaseAdapter(db){
 class Query {
  constructor(table){this.table=ident(table);this.filters=[];this.values=[];this.sort=[];this.columns='*';}
  select(columns='*',opts={}){this.columns=columns==='*'?'*':columns.split(',').map(c=>ident(c.trim())).join(',');this.opts=opts;return this;}
  eq(col,value){this.values.push(value);this.filters.push(`${ident(col)}=$${this.values.length}`);return this;}
  gte(col,value){this.values.push(value);this.filters.push(`${ident(col)}>=$${this.values.length}`);return this;}
  update(values){this.patch=values;return this;}
  order(col,{ascending=true,nullsFirst=false}={}){this.sort.push(`${ident(col)} ${ascending?'asc':'desc'} nulls ${nullsFirst?'first':'last'}`);return this;}
  limit(n){if(!Number.isSafeInteger(n))throw Error('Invalid test limit');this.max=n;return this;}
  single(){this.one=true;return this;}
  async then(resolve,reject){try{return resolve(await this.execute());}catch(e){if(reject)return reject(e);throw e;}}
  async execute(){
   let query,params=[...this.values];
   const where=this.filters.length?' where '+this.filters.join(' and '):'';
   if(this.patch){const fields=Object.entries(this.patch).map(([k,v])=>{params.push(v);return `${ident(k)}=$${params.length}`;});query=`update ${this.table} set ${fields.join(',')}${where} returning *`;}
   else query=`select ${this.opts?.count?'count(*)::int as count':this.columns} from ${this.table}${where}${this.sort.length?' order by '+this.sort.join(','):''}${this.max?' limit '+this.max:''}`;
   try{const raw=await db.query(query,params);const r=JSON.parse(JSON.stringify(raw,(_,v)=>typeof v==='bigint'?Number(v):v));if(this.opts?.count)return {data:null,count:r.rows[0].count,error:null};if(this.one&&r.rows.length!==1)return {data:null,error:{message:'No unique row'}};return {data:this.one?r.rows[0]:r.rows,error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}
  }
 }
 return {from:table=>new Query(table),rpc:async(name,args={})=>{
  const values=Object.values(args),params=Object.keys(args).map((k,i)=>`${ident(k)}=>$${i+1}`);
  try {const r=await db.query(`select public.${ident(name)}(${params.join(',')}) as value`,values);return {data:r.rows[0].value,error:null};}
  catch(e){return {data:null,error:{message:e.message,code:e.code}};}
 }};
}
export async function freshDatabase(modulePath){
 const {PGlite}=await import(modulePath);const db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
 await db.exec((await readFile(resolve(root,'supabase/schema.sql'),'utf8')).replace('create extension if not exists pgcrypto;',''));
 for(const file of ['20260929_atomic_order_limits.sql','20261017_usdt_bep20.sql','20261017_usdt_trc20.sql','20261017_buyer_cancel.sql'])await db.exec(await readFile(resolve(root,'supabase/migrations',file),'utf8'));
 return db;
}
