import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRON_TOKEN, tronHex, validTronAddress, matchingTronLog, verifyTronTransfer, checkedTronHead, tronCandidates, makeTronApi } from '../src/lib/trc20/core.ts';
const address='TRxrRkp3adSyUtQK1NYVA9VJVds1r4fhWb';
const tx='a'.repeat(64), time=Date.now(), height=101;
const blockID=height.toString(16).padStart(16,'0')+'b'.repeat(48);
const quote={recipient:address,amount_micros:19456789,start_block:100,created_at:new Date(time-1000).toISOString(),expires_at:new Date(time+1200000).toISOString()};
const log={address:tronHex(TRON_TOKEN).slice(2),topics:['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0'.repeat(64),tronHex(address).slice(2).padStart(64,'0')],data:quote.amount_micros.toString(16).padStart(64,'0')};
const receipt={id:tx,blockNumber:height,blockTimeStamp:time,receipt:{result:'SUCCESS'},log:[log]};
const block={blockID,block_header:{raw_data:{number:height,timestamp:time}},transactions:[{txID:tx}]};
const apiFor=(r=receipt,b=block)=>async(path)=>path.includes('gettransactioninfo')?r:b;
test('TRON address checksum and official token address',()=>{
 assert.ok(validTronAddress(address)); assert.equal(tronHex(TRON_TOKEN),'41a614f803b6fd780986a42c78ec9c7f77e6ded13c');
 assert.equal(validTronAddress(address.slice(0,-1)+'a'),false);assert.equal(validTronAddress('0x'+'a'.repeat(40)),false);
});
test('TRON matching requires exact official token, recipient and 6-decimal amount',()=>{
 assert.ok(matchingTronLog(log,address,quote.amount_micros));
 assert.equal(matchingTronLog({...log,address:'a'.repeat(40)},address,quote.amount_micros),false);
 assert.equal(matchingTronLog(log,address,quote.amount_micros+1),false);
 assert.equal(matchingTronLog({...log,topics:[...log.topics.slice(0,2),'0'.repeat(64)]},address,quote.amount_micros),false);
});
test('TRON solidified receipt matches block, status, event index and exact transfer',async()=>{
 const proof=await verifyTronTransfer(apiFor(),tx,quote,101);
 assert.equal(proof.txHash,'0x'+tx);assert.equal(proof.blockHash,'0x'+blockID);assert.equal(proof.logIndex,0);
});
test('TRON failed, unconfirmed, old, wrong-block and wrong-token transfers cannot deliver',async()=>{
 for(const [r,b,q,h] of [
  [{...receipt,receipt:{result:'REVERT'}},block,quote,101],
  [receipt,block,quote,100],
  [receipt,block,{...quote,start_block:101},101],
  [receipt,{...block,transactions:[]},quote,101],
  [receipt,{...block,blockID:'c'.repeat(64)},quote,101],
  [{...receipt,log:[{...log,address:'a'.repeat(40)}]},block,quote,101],
  [receipt,block,{...quote,created_at:new Date(time+1000).toISOString()},101],
 ]) await assert.rejects(verifyTronTransfer(apiFor(r,b),tx,q,h));
});
test('TRON wrong network and stale solidified block fail closed',async()=>{
 await assert.rejects(checkedTronHead(async()=>block,time));
 const genesis={blockID:'00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc'};
 await assert.rejects(checkedTronHead(async(path)=>path.includes('bynum')?genesis:block,time+180001));
 assert.equal((await checkedTronHead(async(path)=>path.includes('bynum')?genesis:block,time)).blockID,blockID);
});
test('TRON history follows complete pagination and deduplicates; incomplete history is retryable',async()=>{
 const item={transaction_id:tx,to:address,type:'Transfer',value:String(quote.amount_micros),token_info:{address:TRON_TOKEN,decimals:6}};
 let calls=0;
 const found=await tronCandidates(async(path)=>{calls++;assert.ok(path.includes('only_confirmed=true'));return calls===1?{success:true,data:[item],meta:{fingerprint:'next',links:{next:'ignored'}}}:{success:true,data:[item],meta:{}};},quote,time);
 assert.deepEqual(found,[tx]);assert.equal(calls,2);
 await assert.rejects(tronCandidates(async()=>({success:true,data:[],meta:{links:{next:'x'}}}),quote,time));
 await assert.rejects(tronCandidates(async()=>({success:false,data:[]}),quote,time));
});
test('TRON HTTP 429 / API error never becomes a successful empty scan',async()=>{
 await assert.rejects(makeTronApi('',async()=>new Response('{}',{status:429}))('/walletsolidity/getnowblock',{}));
 await assert.rejects(makeTronApi('',async()=>new Response('{"Error":"unavailable"}',{status:200}))('/walletsolidity/getnowblock',{}));
});
