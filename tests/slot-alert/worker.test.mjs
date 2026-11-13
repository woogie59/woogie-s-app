import {createHandler} from '../../supabase/functions/slot-available-notify/worker.mjs';
import assert from 'node:assert/strict';
let count=0;
const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',msg='33333333-3333-4333-8333-333333333333';
async function run(mode){
 const calls=[],finishes=[];let claims=0;
 const query={select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:[{id}]})}};
 const db={from(t){assert.equal(t,'slot_alert_jobs');return query},async rpc(n,p){if(n==='slot_alert_claim'){claims++;return {data:mode==='skip'?null:{user_id:user,date:'2030-01-02',time:'18:00'}}}assert.equal(n,'slot_alert_finish');finishes.push(p);return mode==='receipt'?{error:new Error('failure')}:{data:true}}};
 const handler=createHandler({db,secret:'test-secret',appId:'test-app',apiKey:'test-api',uuid:()=>msg,fetcher:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});if(mode==='transport')throw Error('timeout');return Response.json(mode==='reject'?{errors:['not subscribed']}:{id:msg,recipients:1})}});
 const req=()=>new Request('https://test.invalid',{method:'POST',headers:{'x-booking-notify-secret':'test-secret'}});
 const res=await handler(req());return {calls,finishes,claims,res:await res.json(),handler};
}
for(const mode of ['ok','reject','transport','skip','receipt']){
 const r=await run(mode);
 if(mode==='skip'){assert.equal(r.calls.length,0);assert.equal(r.finishes.length,0);}else{
  assert.equal(r.calls[0].body.idempotency_key,id);
  assert.deepEqual(r.calls[0].body.include_aliases.external_id,[user]);
  assert.ok(r.calls[0].body.contents.ko.includes('자동 예약되지 않습니다.'));
  assert.equal(r.finishes[0].p_ok,['ok','receipt'].includes(mode));
 }
 if(mode==='receipt')assert.equal(r.res.counts.receipt_failed,1);
 count++;console.log('PASS worker',mode);
}
const {handler}=await run('ok');
assert.equal((await handler(new Request('https://test.invalid',{method:'POST'}))).status,403);count++;console.log('PASS authentication rejects missing secret');
const a=await run('transport'),b=await run('ok');assert.equal(a.calls[0].body.idempotency_key,b.calls[0].body.idempotency_key);count++;console.log('PASS retry same provider idempotency key');
console.log(`RESULT ${count} passed`);
