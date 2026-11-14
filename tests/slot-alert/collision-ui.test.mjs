import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
const p=await b.newPage({viewport:{width:390,height:640},timezoneId:'Asia/Seoul'});
await p.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:['2026-11-12T22:30:00+09:00']))}static now(){return new D('2026-11-12T22:30:00+09:00').getTime()}}});
const font=readFileSync('/tmp/pretendard-regular.woff2').toString('base64');await p.addInitScript(font=>{document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=`@font-face{font-family:Pretendard;src:url(data:font/woff2;base64,${font})}body{font-family:Pretendard!important}`;document.head.append(s)})},font);
await p.goto('http://127.0.0.1:8473/tests/slot-alert/ui.html?blockError=1');
await p.getByText('예약 가능 시간을 확인하지 못했습니다.',{exact:true}).waitFor();
assert.equal(await p.getByRole('button',{name:/빈자리 알림/}).count(),0);
assert.ok(await p.getByRole('button',{name:'다시 확인',exact:true}).isEnabled());
await p.screenshot({path:'/downloads/labdot-ot-read-failure-390x640.png'});
await p.evaluate(()=>{window.__blockReadError=false});
await p.getByRole('button',{name:'다시 확인',exact:true}).click();
await p.getByRole('button',{name:'14:00 빈자리 알림 받기',exact:true}).waitFor();
await p.goto('http://127.0.0.1:8473/tests/slot-alert/ui.html');
await p.getByRole('button',{name:'14:00 빈자리 알림 받기',exact:true}).waitFor();
const ot=p.getByRole('button',{name:/18:00/});assert.ok(await ot.isDisabled());
await p.screenshot({path:'/downloads/labdot-ot-closed-390x640.png'});
await p.getByRole('button',{name:/10:00/}).click();
await p.getByRole('button',{name:'예약확인',exact:true}).waitFor();
await p.evaluate(()=>{window.__blockTakenOnConfirm=true});
await p.getByRole('button',{name:'예약확인',exact:true}).click();
await p.getByText('이미 마감된 시간입니다. 다른 시간을 선택해 주세요.',{exact:true}).waitFor();
console.log('PASS confirm recheck rejects newly occupied OT slot');
console.log('PASS missing RPC fails closed with retry, OT slot disabled, no notification action on OT');
}finally{await b.close()}
