import subprocess,time,pathlib
base=['psql','-h','/tmp','-p','55441','-d','postgres','-v','ON_ERROR_STOP=1','-X','-q']
def sql(s):return subprocess.run(base+['-c',s],capture_output=True,text=True)
fixture=pathlib.Path('tests/slot-alert/schema-fixture.sql').read_text()
assert sql(fixture).returncode==0
assert sql("CREATE TABLE ot_bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),date date,time text,status text DEFAULT 'confirmed'); CREATE FUNCTION _normalize_booking_time(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lpad(split_part(btrim(t),':',1),2,'0')||':'||split_part(btrim(t),':',2) $$;").returncode==0
r=sql(pathlib.Path('supabase/ot_member_slot_guard_candidate.sql').read_text());assert r.returncode==0,r.stderr
for i,(first,second) in enumerate([
 ("INSERT INTO trainer_blocked_slots(block_date,block_time,kind) VALUES('2026-11-20','19:00','ot')","INSERT INTO bookings(date,time) VALUES('2026-11-20','19:00')"),
 ("INSERT INTO bookings(date,time) VALUES('2026-11-21','19:00')","INSERT INTO trainer_blocked_slots(block_date,block_time,kind) VALUES('2026-11-21','19:00','ot')"),
 ("INSERT INTO bookings(date,time) VALUES('2026-11-22','09:00')","INSERT INTO bookings(date,time) VALUES('2026-11-22','9:00')")]):
 # First session holds the write transaction while a second connection attempts the opposite path.
 p=subprocess.Popen(base+['-c','BEGIN; '+first+'; SELECT pg_sleep(1.5); COMMIT;'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 time.sleep(.4)
 r=sql(second);out,err=p.communicate();assert p.returncode==0,err
 assert r.returncode!=0 and 'slot_taken' in r.stderr,(i,r.stdout,r.stderr)
 print('PASS real PostgreSQL two-connection serialization',i+1)
print('RESULT 3 concurrency tests passed')
