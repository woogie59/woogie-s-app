import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const db=new PGlite();
const ADMIN='00000000-0000-0000-0000-000000000001';
await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT ''${ADMIN}''::uuid';
CREATE SCHEMA vault; CREATE TABLE vault.secrets(name text, secret text); CREATE VIEW vault.decrypted_secrets AS SELECT name, secret AS decrypted_secret FROM vault.secrets;
CREATE SCHEMA net; CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint LANGUAGE sql AS 'SELECT 1';
CREATE SCHEMA cron; CREATE TABLE cron.job(jobname text); CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS 'SELECT 1';
CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text);
INSERT INTO public.profiles VALUES ('${ADMIN}','admin');
CREATE FUNCTION public._normalize_booking_time(t text) RETURNS text LANGUAGE sql AS 'SELECT $1';
CREATE FUNCTION public._ot_available_hours(d date) RETURNS int[] LANGUAGE sql AS 'SELECT ARRAY[14,15,16,17,18,19,20,21,22]';
CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date text, time text, status text);
CREATE TABLE public.trainer_blocked_slots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), block_date date NOT NULL, block_time text NOT NULL, label text, kind text NOT NULL DEFAULT 'ot', member_name text);
CREATE UNIQUE INDEX trainer_blocked_slots_date_time_unique ON public.trainer_blocked_slots(block_date, block_time);
CREATE TABLE public.ot_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), member_name text NOT NULL, max_sessions int NOT NULL DEFAULT 2, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ot_bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), link_id uuid REFERENCES public.ot_links(id) ON DELETE CASCADE, date date NOT NULL, time text NOT NULL, name text NOT NULL, status text NOT NULL DEFAULT 'confirmed', block_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ot_pt_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), link_id uuid REFERENCES public.ot_links(id) ON DELETE CASCADE, requested_date date NOT NULL, requested_time text NOT NULL, status text NOT NULL DEFAULT 'requested', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);
CREATE UNIQUE INDEX ot_pt_requests_one_active ON public.ot_pt_requests (link_id) WHERE status IN ('requested','accepted');`);
await db.exec(fs.readFileSync('supabase/ot_pt_request_notify_live.sql','utf8'));
await db.exec(fs.readFileSync('supabase/ot_pt_request_instant_confirm.sql','utf8'));

const q=(s)=>db.query(s);
const fail=(m)=>{throw new Error(m)};

// link with 2 completed OT sessions (gate satisfied)
const l=(await q(`INSERT INTO public.ot_links(member_name) VALUES('테스트더미') RETURNING id, token`)).rows[0];
await q(`INSERT INTO public.ot_bookings(link_id,date,time,name,status) VALUES('${l.id}','2026-11-10','14:00','테스트더미','completed'),('${l.id}','2026-11-12','14:00','테스트더미','completed')`);

// 1) request → instantly accepted + block linked + notify job queued (accepted now triggers)
let res=(await q(`SELECT public.ot_request_pt('${l.token}','2026-11-23','14:00') AS j`)).rows[0].j;
if(!res.ok) fail('request failed: '+JSON.stringify(res));
let req=(await q(`SELECT status, block_id FROM public.ot_pt_requests WHERE id='${res.request_id}'`)).rows[0];
if(req.status!=='accepted'||!req.block_id) fail('not instantly confirmed/linked: '+JSON.stringify(req));
let blk=(await q(`SELECT block_date::text d, block_time t, label, kind FROM public.trainer_blocked_slots WHERE id='${req.block_id}'`)).rows[0];
if(!blk||blk.label!=='PT'||blk.kind!=='ot'||blk.d!=='2026-11-23'||blk.t!=='14:00') fail('block wrong: '+JSON.stringify(blk));
let job=(await q(`SELECT state FROM public.ot_pt_request_notify_jobs WHERE request_id='${res.request_id}'`)).rows[0];
if(!job) fail('notify job not queued for accepted request');

// 2) duplicate request same link → already_accepted, still 1 block
res=(await q(`SELECT public.ot_request_pt('${l.token}','2026-11-23','15:00') AS j`)).rows[0].j;
if(res.ok||res.reason!=='already_accepted') fail('dup not blocked: '+JSON.stringify(res));
let cnt=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots`)).rows[0].c;
if(cnt!==1) fail('dup block: '+cnt);

// 3) other link same slot → slot_taken (block conflict)
const l2=(await q(`INSERT INTO public.ot_links(member_name) VALUES('김더미') RETURNING id, token`)).rows[0];
await q(`INSERT INTO public.ot_bookings(link_id,date,time,name,status) VALUES('${l2.id}','2026-11-10','15:00','김더미','completed'),('${l2.id}','2026-11-12','15:00','김더미','completed')`);
res=(await q(`SELECT public.ot_request_pt('${l2.token}','2026-11-23','14:00') AS j`)).rows[0].j;
if(res.ok||res.reason!=='slot_taken') fail('block conflict missed: '+JSON.stringify(res));

// 4) conflict with regular booking
await q(`INSERT INTO public.bookings(date,time,status) VALUES('2026-11-24','15:00','Scheduled')`);
res=(await q(`SELECT public.ot_request_pt('${l2.token}','2026-11-24','15:00') AS j`)).rows[0].j;
if(res.ok||res.reason!=='slot_taken') fail('booking conflict missed: '+JSON.stringify(res));

// 5) conflict with confirmed ot_booking (다른 링크 소유 — 요청 링크의 confirmed는 게이트가 막으므로)
const l3=(await q(`INSERT INTO public.ot_links(member_name) VALUES('박더미') RETURNING id, token`)).rows[0];
await q(`INSERT INTO public.ot_bookings(link_id,date,time,name,status) VALUES('${l3.id}','2026-11-10','16:00','박더미','completed'),('${l3.id}','2026-11-12','16:00','박더미','completed')`);
await q(`INSERT INTO public.ot_bookings(link_id,date,time,name,status) VALUES('${l2.id}','2026-11-25','16:00','김더미','confirmed')`);
res=(await q(`SELECT public.ot_request_pt('${l3.token}','2026-11-25','16:00') AS j`)).rows[0].j;
if(res.ok||res.reason!=='slot_taken') fail('ot_booking conflict missed: '+JSON.stringify(res));

// 6) legacy requested + admin accept → block created; accept again → not_found; no dup block
const r6=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time,status) VALUES('${l2.id}','2026-11-26','10:00','requested') RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_admin_pt_decide('${r6.id}','accepted') AS j`)).rows[0].j;
if(!res.ok) fail('legacy accept failed: '+JSON.stringify(res));
let req6=(await q(`SELECT status, block_id FROM public.ot_pt_requests WHERE id='${r6.id}'`)).rows[0];
if(req6.status!=='accepted'||!req6.block_id) fail('legacy accept not linked');
res=(await q(`SELECT public.ot_admin_pt_decide('${r6.id}','accepted') AS j`)).rows[0].j;
if(res.ok||res.reason!=='not_found') fail('dup decide not idempotent: '+JSON.stringify(res));
cnt=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots WHERE block_date='2026-11-26'`)).rows[0].c;
if(cnt!==1) fail('decide dup block: '+cnt);

// 7) admin decline releases only the linked block; unrelated block survives
res=(await q(`SELECT public.ot_admin_pt_decide('${r6.id}','declined') AS j`)).rows[0].j;
// status is accepted now → not_found (decide only acts on requested). decline path needs a requested+blocked row:
const l4=(await q(`INSERT INTO public.ot_links(member_name) VALUES('이더미') RETURNING id, token`)).rows[0];
const r7=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time,status,block_id) VALUES('${l4.id}','2026-11-27','11:00','requested',NULL) RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_admin_pt_decide('${r7.id}','accepted') AS j`)).rows[0].j;
if(!res.ok) fail('accept r7 failed');
await q(`UPDATE public.ot_pt_requests SET status='requested' WHERE id='${r7.id}'`); // simulate pre-decline state
res=(await q(`SELECT public.ot_admin_pt_decide('${r7.id}','declined') AS j`)).rows[0].j;
if(!res.ok) fail('decline failed: '+JSON.stringify(res));
const gone=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots WHERE block_date='2026-11-27'`)).rows[0].c;
if(gone!==0) fail('decline did not release block');
const others=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots`)).rows[0].c;
if(others!==2) fail('unrelated blocks touched: '+others); // r1 block + r6 block survive

// 8) member cancel of an instantly-ACCEPTED row releases only its block (regression: cancel scope preserved)
const l5=(await q(`INSERT INTO public.ot_links(member_name) VALUES('최더미') RETURNING id, token`)).rows[0];
const r8=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time,status,block_id) VALUES('${l5.id}','2026-11-28','12:00','requested',NULL) RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_admin_pt_decide('${r8.id}','accepted') AS j`)).rows[0].j;
if(!res.ok) fail('accept r8 failed');
res=(await q(`SELECT public.ot_cancel_pt_request('${l5.token}','${r8.id}') AS j`)).rows[0].j;
if(!res.ok) fail('cancel on accepted failed: '+JSON.stringify(res));
const gone8=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots WHERE block_date='2026-11-28'`)).rows[0].c;
if(gone8!==0) fail('cancel did not release block');
const st8=(await q(`SELECT status FROM public.ot_pt_requests WHERE id='${r8.id}'`)).rows[0].status;
if(st8!=='cancelled') fail('cancel did not set cancelled: '+st8);
// 9) legacy requested row still cancellable
const l6=(await q(`INSERT INTO public.ot_links(member_name) VALUES('오더미') RETURNING id, token`)).rows[0];
const r9=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time,status,block_id) VALUES('${l6.id}','2026-11-29','12:00','requested',NULL) RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_cancel_pt_request('${l6.token}','${r9.id}') AS j`)).rows[0].j;
if(!res.ok) fail('cancel on requested failed: '+JSON.stringify(res));
// 10) double cancel is not_found (idempotent no-op)
res=(await q(`SELECT public.ot_cancel_pt_request('${l6.token}','${r9.id}') AS j`)).rows[0].j;
if(res.ok||res.reason!=='not_found') fail('double cancel should be not_found: '+JSON.stringify(res));

console.log('DRY-RUN PASS: instant accept+block+notify, dup guard, slot_taken x3, legacy accept idempotent, decline release, cancel accepted+requested release only linked block, double cancel safe');
