import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();let count=0;
const test=async(n,f)=>{await f();console.log('PASS',n);count++};
try{
await db.exec(fs.readFileSync('tests/slot-alert/schema-fixture.sql','utf8'));
await db.exec(`CREATE TABLE ot_bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),date date,time text,status text DEFAULT 'confirmed'); CREATE FUNCTION _normalize_booking_time(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lpad(split_part(btrim(t),':',1),2,'0')||':'||split_part(btrim(t),':',2) $$; CREATE FUNCTION pg_advisory_xact_lock(bigint) RETURNS void LANGUAGE sql AS $$ SELECT $$;`);
// Reproduce current production schema: PT-only unique index cannot guard cross-table overlap.
await db.exec(`CREATE UNIQUE INDEX unique_booking_slot ON bookings(date,time); INSERT INTO trainer_blocked_slots(block_date,block_time,kind) VALUES('2026-11-17','19:00','ot'); INSERT INTO ot_bookings(date,time) VALUES('2026-11-17','19:00'); INSERT INTO bookings(date,time) VALUES('2026-11-17','19:00');`);
await test('current PT unique index permits OT/PT collision',async()=>assert.equal((await db.query("SELECT count(*)::int n FROM bookings WHERE date='2026-11-17'")).rows[0].n,1));
await db.exec(fs.readFileSync('supabase/ot_member_slot_guard_candidate.sql','utf8').replace("NOTIFY pgrst,'reload schema';",''));
await test('migration preserves existing collision rows',async()=>assert.equal((await db.query('SELECT count(*)::int n FROM bookings')).rows[0].n,1));
await test('OT hold blocks regular booking',async()=>{await db.exec("INSERT INTO trainer_blocked_slots(block_date,block_time,kind) VALUES('2026-11-18','19:00','ot')");await assert.rejects(()=>db.exec("INSERT INTO bookings(date,time) VALUES('2026-11-18','19:00')"),/slot_taken/)});
await test('regular booking blocks later OT hold',async()=>{await db.exec("INSERT INTO bookings(date,time) VALUES('2026-11-18','20:00')");await assert.rejects(()=>db.exec("INSERT INTO trainer_blocked_slots(block_date,block_time,kind) VALUES('2026-11-18','20:00','ot')"),/slot_taken/)});
await test('orphan confirmed OT still blocks regular booking',async()=>{await db.exec("INSERT INTO ot_bookings(date,time) VALUES('2026-11-18','21:00')");await assert.rejects(()=>db.exec("INSERT INTO bookings(date,time) VALUES('2026-11-18','21:00')"),/slot_taken/)});
await test('normalized time duplicate is blocked',async()=>{await db.exec("INSERT INTO bookings(date,time) VALUES('2026-11-19','09:00')");await assert.rejects(()=>db.exec("INSERT INTO bookings(date,time) VALUES('2026-11-19','9:00')"),/slot_taken/)});
await test('existing collision status update still works',async()=>db.exec("UPDATE bookings SET status='completed' WHERE date='2026-11-17'"));
await test('metadata-only hold update still works',async()=>db.exec("UPDATE trainer_blocked_slots SET kind='ot' WHERE block_date='2026-11-17'"));
await test('moving regular booking into blocked time fails',async()=>assert.rejects(()=>db.exec("UPDATE bookings SET time='19:00' WHERE date='2026-11-18' AND time='20:00'"),/slot_taken/));
await test('authenticated minimal RPC returns only date time kind',async()=>{await db.exec('SET ROLE authenticated');const r=(await db.query("SELECT * FROM get_blocked_slots_public('2026-11-17')")).rows;assert.deepEqual(Object.keys(r[0]),['block_date','block_time','kind']);await db.exec('RESET ROLE')});
await test('anonymous cannot read minimal RPC',async()=>{await db.exec('SET ROLE anon');await assert.rejects(()=>db.query("SELECT * FROM get_blocked_slots_public('2026-11-17')"),/permission denied/);await db.exec('RESET ROLE')});
console.log('RESULT',count,'passed; concurrency not represented by PGlite lock stub');
}finally{await db.close()}
