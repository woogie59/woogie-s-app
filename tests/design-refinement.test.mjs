import assert from 'node:assert/strict';
import { isDesignRefinementEnabled, formatBookingDateKo } from '../src/features/design/designRefinement.js';
assert.equal(isDesignRefinementEnabled({name:'테스트2',role:'user'}), true);
for (const p of [null, {}, {name:'테스트용1',role:'user'}, {name:'송이담',role:'user'}, {name:'회원',role:'user'}, {name:'테스트2',role:'admin'}, {name:'테스트2'}, {name:'테스트2 ',role:'user'}]) assert.equal(isDesignRefinementEnabled(p), false);
assert.equal(formatBookingDateKo('2026-10-27', '14:00:00'), '10월 27일 (화) 14:00');
console.log('PASS test2/member gate, exclusion of admin/other members, Korean dates');
