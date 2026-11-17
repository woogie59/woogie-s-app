import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const db=new PGlite();
const ADMIN='00000000-0000-0000-0000-000000000001';
await db.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT ''${ADMIN}''::uuid';
CREATE TABLE public.profiles(id uuid PRIMARY KEY, role text);
INSERT INTO public.profiles VALUES ('${ADMIN}','admin');
CREATE FUNCTION public._normalize_booking_time(t text) RETURNS text LANGUAGE sql AS 'SELECT $1';
CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date text, time text, status text);
CREATE TABLE public.trainer_blocked_slots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), block_date date NOT NULL, block_time text NOT NULL, label text, kind text NOT NULL DEFAULT 'ot', member_name text);
CREATE UNIQUE INDEX trainer_blocked_slots_date_time_unique ON public.trainer_blocked_slots(block_date, block_time);
CREATE TABLE public.ot_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), member_name text NOT NULL, max_sessions int NOT NULL DEFAULT 2, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ot_bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), link_id uuid REFERENCES public.ot_links(id) ON DELETE CASCADE, date date NOT NULL, time text NOT NULL, name text NOT NULL, status text NOT NULL DEFAULT 'confirmed', block_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ot_pt_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), link_id uuid REFERENCES public.ot_links(id) ON DELETE CASCADE, requested_date date NOT NULL, requested_time text NOT NULL, status text NOT NULL DEFAULT 'requested', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);`);
await db.exec(fs.readFileSync('supabase/ot_pt_request_accept_block.sql','utf8'));

const q=(s)=>db.query(s);
const fail=(m)=>{throw new Error(m)};

// link + request
const l=(await q(`INSERT INTO public.ot_links(member_name) VALUES('신정인') RETURNING id, token`)).rows[0];
const r1=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time) VALUES('${l.id}','2026-11-23','14:00') RETURNING id`)).rows[0];

// 1) accept → block created and linked
let res=(await q(`SELECT public.ot_admin_pt_decide('${r1.id}','accepted') AS j`)).rows[0].j;
if(!res.ok) fail('accept failed: '+JSON.stringify(res));
let req=(await q(`SELECT status, block_id FROM public.ot_pt_requests WHERE id='${r1.id}'`)).rows[0];
if(req.status!=='accepted'||!req.block_id) fail('request not accepted/linked: '+JSON.stringify(req));
let blk=(await q(`SELECT block_date::text, block_time, label, kind FROM public.trainer_blocked_slots WHERE id='${req.block_id}'`)).rows[0];
if(!blk||blk.label!=='PT'||blk.kind!=='ot'||blk.block_date!=='2026-11-23'||blk.block_time!=='14:00') fail('block wrong: '+JSON.stringify(blk));

// 2) duplicate accept → not_found, still exactly 1 block
res=(await q(`SELECT public.ot_admin_pt_decide('${r1.id}','accepted') AS j`)).rows[0].j;
if(res.ok||res.reason!=='not_found') fail('dup accept not idempotent: '+JSON.stringify(res));
let cnt=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots`)).rows[0].c;
if(cnt!==1) fail('dup block created: '+cnt);

// 3) second request same slot → slot_taken, status stays requested
const l2=(await q(`INSERT INTO public.ot_links(member_name) VALUES('김더미') RETURNING id, token`)).rows[0];
const r2=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time) VALUES('${l2.id}','2026-11-23','14:00') RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_admin_pt_decide('${r2.id}','accepted') AS j`)).rows[0].j;
if(res.ok||res.reason!=='slot_taken') fail('expected slot_taken: '+JSON.stringify(res));
req=(await q(`SELECT status, block_id FROM public.ot_pt_requests WHERE id='${r2.id}'`)).rows[0];
if(req.status!=='requested'||req.block_id) fail('slot_taken but state changed: '+JSON.stringify(req));

// 4) conflict with a regular booking
await q(`INSERT INTO public.bookings(date,time,status) VALUES('2026-11-24','15:00','Scheduled')`);
const r3=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time) VALUES('${l2.id}','2026-11-24','15:00') RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_admin_pt_decide('${r3.id}','accepted') AS j`)).rows[0].j;
if(res.ok||res.reason!=='slot_taken') fail('booking conflict missed: '+JSON.stringify(res));

// 5) conflict with a confirmed ot_booking
await q(`INSERT INTO public.ot_bookings(link_id,date,time,name,status) VALUES('${l2.id}','2026-11-25','16:00','김더미','confirmed')`);
const r4=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time) VALUES('${l2.id}','2026-11-25','16:00') RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_admin_pt_decide('${r4.id}','accepted') AS j`)).rows[0].j;
if(res.ok||res.reason!=='slot_taken') fail('ot_booking conflict missed: '+JSON.stringify(res));

// 6) cancel releases only the linked block; unrelated block survives
await q(`INSERT INTO public.trainer_blocked_slots(block_date,block_time,label,kind) VALUES('2026-11-26','10:00','OT','ot')`);
// make r1 cancellable again to exercise release path (cancel only acts on requested in production)
await q(`UPDATE public.ot_pt_requests SET status='requested' WHERE id='${r1.id}'`);
res=(await q(`SELECT public.ot_cancel_pt_request('${l.token}','${r1.id}') AS j`)).rows[0].j;
if(!res.ok) fail('cancel failed: '+JSON.stringify(res));
cnt=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots WHERE id='${req_block_of_r1()}'`)).rows?.[0]?.c;
function req_block_of_r1(){return '00000000-0000-0000-0000-000000000000'}
const left=(await q(`SELECT block_date::text d, block_time t FROM public.trainer_blocked_slots`)).rows;
if(left.length!==1||left[0].d!=='2026-11-26') fail('wrong blocks survive cancel: '+JSON.stringify(left));

// 7) decline creates no block
const r5=(await q(`INSERT INTO public.ot_pt_requests(link_id,requested_date,requested_time) VALUES('${l2.id}','2026-11-27','10:00') RETURNING id`)).rows[0];
res=(await q(`SELECT public.ot_admin_pt_decide('${r5.id}','declined') AS j`)).rows[0].j;
if(!res.ok) fail('decline failed: '+JSON.stringify(res));
const b2=(await q(`SELECT count(*)::int c FROM public.trainer_blocked_slots WHERE block_date='2026-11-27'`)).rows[0].c;
if(b2!==0) fail('decline created a block');

console.log('ACCEPT-BLOCK DRY-RUN PASS: accept→block+link, dup-accept idempotent, slot_taken on block/booking/ot_booking conflicts, cancel releases only linked block, decline no block');
