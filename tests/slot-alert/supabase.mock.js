const params=new URLSearchParams(location.search);
const own='00000000-0000-4000-8000-000000000001';
const date='2026-11-13';
let enrolled=params.get('registered')==='1';
window.__mockRpc=[];
window.__blockReadError=params.get('blockError')==='1';
window.__blockTakenOnConfirm=false;
const bookings=[{id:'b1',user_id:'other',date,time:'14:00'},{id:'b2',user_id:'other',date,time:'15:00'},{id:'b3',user_id:own,date,time:'16:00'},{id:'cancelled1',user_id:own,date,time:'18:00',status:'cancelled'}];
export const supabase={
 from(table){const filters=[];const q={select(){return this},eq(k,v){filters.push([k,v]);return this},order(){return this},in(){return this},then(resolve){let data=[];
 if(table==='trainer_settings') data=Array.from({length:7},(_,i)=>({day_of_week:i,off:false,available_hours:[10,11,12,13,14,15,16,17,18,19,20,21,22]}));
 if(table==='bookings')data=bookings.filter(r=>filters.every(([k,v])=>r[k]===v));
 if(table==='slot_alert_requests')data=enrolled?[{id:'r1',slot_time:'14:00',state:'active'}]:[];
 return Promise.resolve({data,error:null}).then(resolve);}};return q;},
 async rpc(name,args){window.__mockRpc.push({name,args});if(name==='slot_alert_capabilities')return {data:params.get('enabled')!=='0'};
 if(name==='get_blocked_slots_public')return window.__blockReadError?{data:null,error:{message:'missing function'}}:{data:[{block_date:date,block_time:window.__blockTakenOnConfirm?'10:00':'18:00',kind:'ot'}]};
 if(name==='slot_alert_register'){enrolled=true;return {data:{ok:true,id:'r1'}}}if(name==='slot_alert_cancel'){enrolled=false;return {data:{ok:true}}}return {data:null};},
};
