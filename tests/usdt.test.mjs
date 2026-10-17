import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountText, atomicAmount, checkedHead, getLiveRate, makeRpc, matchingTransfer, recipientTopic, verifyTransfer, USDT_TOKEN, TRANSFER_TOPIC } from '../src/lib/bep20/core.ts';
const address='0xaf70d68c0bae1555411d99109b402d7457df2cab';
const tx='0x'+'a'.repeat(64), hash='0x'+'b'.repeat(64);
const now=Date.now(), blockTime=Math.floor(now/1000);
const quote={recipient:address,amount_micros:19456789,start_block:100,created_at:new Date(now-5000).toISOString()};
const log={address:USDT_TOKEN,topics:[TRANSFER_TOPIC,'0x'+'0'.repeat(64),recipientTopic(address)],data:'0x'+BigInt(atomicAmount(quote.amount_micros)).toString(16).padStart(64,'0'),blockNumber:'0x65',blockHash:hash,transactionHash:tx,logIndex:'0x0',removed:false};
const block={number:'0x65',hash,timestamp:'0x'+blockTime.toString(16)};
const receipt={status:'0x1',transactionHash:tx,blockNumber:'0x65',blockHash:hash,logs:[log]};
const rpc=async(method)=>method==='eth_getTransactionReceipt'?receipt:block;
test('amount conversion preserves six decimal precision and 18 token decimals',()=>{
 assert.equal(amountText(19456789),'19.456789'); assert.equal(atomicAmount(19456789),'19456789000000000000');
 assert.throws(()=>amountText(1.5)); assert.throws(()=>amountText(Number.MAX_SAFE_INTEGER+1));
});
test('only exact recipient, contract, amount and unremoved Transfer match',()=>{
 assert.equal(matchingTransfer(log,address,19456789),true);
 for(const bad of [{...log,address:'0x'+'1'.repeat(40)},{...log,data:'0x'+'0'.repeat(64)},{...log,removed:true},{...log,topics:[TRANSFER_TOPIC,log.topics[1],recipientTopic('0x'+'2'.repeat(40))]},{...log,topics:[]}]) assert.equal(matchingTransfer(bad,address,19456789),false);
 assert.equal(matchingTransfer(log,address,19456788),false); assert.equal(matchingTransfer(log,address,19456790),false);
});
test('successful finalized receipt is accepted',async()=>{
 const proof=await verifyTransfer(rpc,log,quote,102); assert.equal(proof.txHash,tx); assert.equal(proof.blockNumber,101);
});
test('unfinalized, failed, reorged, missing-log and replayed receipts are rejected',async()=>{
 await assert.rejects(verifyTransfer(rpc,log,quote,100));
 await assert.rejects(verifyTransfer(rpc,log,{...quote,start_block:101},102));
 await assert.rejects(verifyTransfer(rpc,log,{...quote,created_at:new Date(now+5000).toISOString()},102));
 for(const patch of [{status:'0x0'},{blockHash:'0x'+'c'.repeat(64)},{logs:[]},{transactionHash:'0x'+'c'.repeat(64)},{blockNumber:'0x64'}]){
  await assert.rejects(verifyTransfer(async(method)=>method==='eth_getTransactionReceipt'?{...receipt,...patch}:block,log,quote,102));
 }
 await assert.rejects(verifyTransfer(async(method)=>method==='eth_getTransactionReceipt'?receipt:{...block,hash:'0x'+'c'.repeat(64)},log,quote,102));
});
test('wrong network and stale finalized head fail closed',async()=>{
 await assert.rejects(checkedHead(async()=> '0x1',now));
 await assert.rejects(checkedHead(async(method)=>method==='eth_chainId'?'0x38':{...block,timestamp:'0x1'},now));
 assert.equal((await checkedHead(async(method)=>method==='eth_chainId'?'0x38':block,now)).hash,hash);
});
function rateResponse(currency='USDT',rate='6.681031432',time=now,status=200){return new Response(JSON.stringify({data:{currency,rates:{CNY:rate}}}),{status,headers:{date:new Date(time).toUTCString()}});}
test('live rate validates currency, numeric range, freshness and HTTP failure',async()=>{
 assert.equal((await getLiveRate(async()=>rateResponse(),now)).rate,'6.681031432');
 for(const args of [['USD'],['USDT','NaN'],['USDT','0'],['USDT','200'],['USDT','6.8',now-120000],['USDT','6.8',now,503]]) await assert.rejects(getLiveRate(async()=>rateResponse(...args),now));
});
test('RPC errors never become empty successful log responses',async()=>{
 await assert.rejects(makeRpc('https://rpc.example',async()=>new Response(JSON.stringify({error:{code:-1}})))('eth_getLogs'));
 await assert.rejects(makeRpc('https://rpc.example',async()=>new Response('{}',{status:503}))('eth_getLogs'));
 assert.throws(()=>makeRpc('http://rpc.example'));
});
