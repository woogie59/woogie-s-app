import assert from 'node:assert/strict';
globalThis.Deno={env:{get:k=>k==='OT_NOTIFY_TEST_NO_SERVE'?'1':k.includes('KEY')?'key':k.includes('APP')?'app':'url'}};
const {handler}=await import('./ot-notify-handler-test.mjs');
const id='11111111-1111-4111-8111-111111111111';
let state, calls, mode;
function reset(m='ok'){state={state:'pending',attempts:0,claim_token:null};calls=[];mode=m;}
class Query {
 constructor(t){this.t=t;this.filters=[];this.patch=null;}
 update(p){this.patch=p;return this;}
 eq(k,v){this.filters.push([k,v]);return this;}
 is(k,v){return this.eq(k,v);}
 select(){return this;}
 limit(){return this;}
 maybeSingle(){return this.then(x=>({...x,data:Array.isArray(x.data)?x.data[0]??null:x.data}));}
 then(resolve,reject){let data=null,error=null;
 if(this.t==='ot_booking_notify_jobs'){
  if(this.filters.every(([k,v])=>k==='booking_id'||state[k]===v)){if(this.patch)Object.assign(state,this.patch);data=[{attempts:state.attempts}];}else data=[];
 }else if(this.t==='ot_bookings') data={date:'2026-10-29',time:'18:00',name:'알림검증더미',status:mode==='cancelled'?'cancelled':'confirmed',admin_notified_at:mode==='already'?'2026-01-01':null};
 else if(this.t==='profiles') data=mode==='multi'?[{onesignal_id:'a'},{onesignal_id:'b'}]:mode==='no-target'?[{onesignal_id:null}]:[{onesignal_id:'test-subscription'}];
 return Promise.resolve({data,error}).then(resolve,reject);
 }
}
globalThis.mockDb={rpc:async()=>({data:'private-test-secret',error:null}),from:t=>new Query(t)};
globalThis.fetch=async(url,o)=>{calls.push(JSON.parse(o.body));assert.equal(o.headers.Authorization,'Key key');if(mode==='transport')throw Error('network');return Response.json(mode==='rejected'?{errors:['bad']}:{id,recipients:mode==='zero'?0:1},{status:200});};
const request=(secret='private-test-secret',bid=id)=>new Request('https://unit.invalid',{method:'POST',headers:{'content-type':'application/json','x-ot-webhook-secret':secret},body:JSON.stringify({booking_id:bid})});
let tests=0;
for(const s of ['','wrong']){reset();assert.equal((await handler(request(s))).status,403);assert.equal(calls.length,0);tests++;}
reset();assert.equal((await handler(request('private-test-secret','invalid'))).status,400);tests++;
for(const m of ['cancelled','already']){reset(m);assert.equal((await handler(request())).status,200);assert.equal(calls.length,0);assert.equal(state.state,'skipped');tests++;}
for(const m of ['multi','no-target']){reset(m);assert.equal((await handler(request())).status,502);assert.equal(calls.length,0);assert.equal(state.last_error,'admin_target_unavailable');tests++;}
reset();assert.equal((await handler(request())).status,200);assert.equal(state.state,'provider_accepted');assert.equal(calls.length,1);assert.equal(calls[0].idempotency_key,id);assert.deepEqual(calls[0].include_subscription_ids,['test-subscription']);tests++;
assert.equal((await handler(request())).status,200);assert.equal(calls.length,1);tests++;
for(const m of ['rejected','zero','transport']){reset(m);assert.equal((await handler(request())).status,502);assert.equal(state.state,'pending');assert.equal(state.attempts,1);tests++;}
reset('rejected');state.attempts=4;await handler(request());assert.equal(state.state,'failed');tests++;
console.log(`PASS ${tests} cases; network fully mocked; no external notification sent.`);
