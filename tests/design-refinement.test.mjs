import assert from 'node:assert/strict';
import { isDesignRefinementEnabled, formatBookingDateKo } from '../src/features/design/designRefinement.js';
assert.equal(isDesignRefinementEnabled({id:'54f02379-a548-4bf8-aaf5-150055b6ec1e',role:'user'}), true);
assert.equal(isDesignRefinementEnabled({id:'11111111-1111-4111-8111-111111111111',role:'user'}), true);
for (const p of [null, {}, {name:'테스트용1',role:'user'}, {name:'송이담',role:'user'}, {name:'회원',role:'user'}, {id:'54f02379-a548-4bf8-aaf5-150055b6ec1e',role:'admin'}, {name:'테스트2'}, {name:'테스트2 ',role:'user'}]) assert.equal(isDesignRefinementEnabled(p), false);
assert.equal(formatBookingDateKo('2026-10-27', '14:00:00'), '10월 27일 (화) 14:00');
console.log('PASS all authenticated members, qq regression, exclusion of admins/anonymous, Korean dates');

import fs from 'node:fs';
const list=fs.readFileSync(new URL('../src/features/members/MemberList.jsx',import.meta.url),'utf8');
assert.equal((list.match(/\(u\.computedRemaining \?\? 0\) <= 9/g)||[]).length,2);
assert.ok(list.includes('만료 임박(9회 이하)'));
assert.ok(list.includes("if (remaining <= 2) return 'bg-red-100 text-red-700'"));
assert.ok(list.includes("if (remaining <= 9) return 'bg-amber-100 text-amber-700'"));
