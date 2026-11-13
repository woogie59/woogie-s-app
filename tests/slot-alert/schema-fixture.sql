CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, name text, status text DEFAULT 'active');
CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,date text,time text,status text DEFAULT 'confirmed');
CREATE TABLE public.trainer_blocked_slots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),block_date date,block_time text,kind text);
CREATE TABLE public.trainer_holidays(date text);
CREATE TABLE public.trainer_open_dates(date date,available_hours int[]);
CREATE TABLE public.trainer_settings(day_of_week int,off boolean,available_hours int[]);
CREATE FUNCTION public._ot_available_hours(p_date date) RETURNS int[] LANGUAGE plpgsql AS $$
DECLARE hours int[];
BEGIN
 SELECT available_hours INTO hours FROM trainer_open_dates WHERE date=p_date;
 IF FOUND THEN RETURN hours; END IF;
 IF EXISTS(SELECT 1 FROM trainer_holidays WHERE date=p_date::text) THEN RETURN NULL; END IF;
 SELECT available_hours INTO hours FROM trainer_settings WHERE day_of_week=extract(dow FROM p_date)::int AND NOT off;
 RETURN hours;
END;
$$;
INSERT INTO trainer_settings SELECT i,false,ARRAY[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22] FROM generate_series(0,6)i;
INSERT INTO profiles VALUES('00000000-0000-4000-8000-000000000001','합성회원가','active'),('00000000-0000-4000-8000-000000000002','합성회원나','active'),('00000000-0000-4000-8000-000000000003','합성기존예약','active'),('00000000-0000-4000-8000-000000000004','합성미허용회원','active');
