import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
try {
 await db.exec(fs.readFileSync('tests/slot-alert/schema-fixture.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/slot_alert_core.sql','utf8'));
 await db.exec("ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user'; UPDATE profiles SET status='inactive' WHERE name='합성회원나'; UPDATE profiles SET role='admin' WHERE name='합성기존예약';");
 const before=(await db.query('SELECT * FROM profiles ORDER BY id')).rows;
 await db.exec(fs.readFileSync('supabase/slot_alert_all_members.sql','utf8'));
 const rows=(await db.query('SELECT name,slot_alert_enabled(id) enabled FROM profiles ORDER BY id')).rows;
 assert.deepEqual(rows.map(r=>r.enabled),[true,false,false,true]);
 assert.deepEqual((await db.query('SELECT * FROM profiles ORDER BY id')).rows,before);
 assert.equal((await db.query('SELECT slot_alert_enabled(null) enabled')).rows[0].enabled,false);
 assert.equal((await db.query("SELECT slot_alert_enabled('ffffffff-ffff-4fff-8fff-ffffffffffff') enabled")).rows[0].enabled,false);
 await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false); SET ROLE authenticated;");
 assert.equal((await db.query('SELECT slot_alert_capabilities() enabled')).rows[0].enabled,true);
 console.log('PASS all active members enabled, inactive/admin/null/missing excluded, profiles unchanged, authenticated capability true');
} finally {await db.close();}
