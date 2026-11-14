-- Owner approval: phonemsg-01M7CSY3QNDX73FYG60NNG0BSF, 2026-11-14.
-- No existing rows, indexes, policies or functions are removed or rewritten.
BEGIN;
CREATE FUNCTION public.get_blocked_slots_public(p_date date)
RETURNS TABLE(block_date date,block_time text,kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT b.block_date,b.block_time,b.kind FROM public.trainer_blocked_slots b WHERE b.block_date=p_date;
$$;
REVOKE ALL ON FUNCTION public.get_blocked_slots_public(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_blocked_slots_public(date) TO authenticated;

-- Both write paths serialize on the same normalized date/time key.
-- Triggers are VOLATILE (default); post-lock reads use a fresh READ COMMITTED snapshot.
CREATE FUNCTION public.guard_shared_booking_slot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d date; t text;
BEGIN
 IF TG_TABLE_NAME='bookings' THEN
  IF coalesce(NEW.status,'')='cancelled' THEN RETURN NEW; END IF;
  d:=left(btrim(NEW.date::text),10)::date;
  t:=public._normalize_booking_time(NEW.time);
  -- Existing collisions are not repaired here; unrelated metadata/status updates keep working.
  IF TG_OP='UPDATE' THEN
   IF left(btrim(OLD.date::text),10)::date=d AND public._normalize_booking_time(OLD.time)=t AND coalesce(OLD.status,'')<>'cancelled' THEN RETURN NEW; END IF;
  END IF;
 ELSE
  d:=NEW.block_date; t:=public._normalize_booking_time(NEW.block_time);
  IF TG_OP='UPDATE' THEN
   IF OLD.block_date=d AND public._normalize_booking_time(OLD.block_time)=t THEN RETURN NEW; END IF;
  END IF;
 END IF;
 IF d IS NULL OR t IS NULL OR t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
  RAISE EXCEPTION 'invalid_slot' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('labdot-slot:'||d::text||':'||t,0));
 IF TG_TABLE_NAME='bookings' THEN
  IF EXISTS(SELECT 1 FROM public.trainer_blocked_slots b WHERE b.block_date=d AND public._normalize_booking_time(b.block_time)=t)
     OR EXISTS(SELECT 1 FROM public.ot_bookings o WHERE o.date=d AND public._normalize_booking_time(o.time)=t AND o.status='confirmed')
     OR EXISTS(SELECT 1 FROM public.bookings b WHERE left(btrim(b.date::text),10)=d::text AND public._normalize_booking_time(b.time)=t AND coalesce(b.status,'')<>'cancelled' AND b.id<>NEW.id) THEN
   RAISE EXCEPTION 'slot_taken' USING ERRCODE='23505';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.bookings b WHERE left(btrim(b.date::text),10)=d::text AND public._normalize_booking_time(b.time)=t AND coalesce(b.status,'')<>'cancelled')
     OR EXISTS(SELECT 1 FROM public.trainer_blocked_slots b WHERE b.block_date=d AND public._normalize_booking_time(b.block_time)=t AND b.id<>NEW.id) THEN
   RAISE EXCEPTION 'slot_taken' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_shared_booking_slot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_shared_booking_slot BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_shared_booking_slot();
CREATE TRIGGER guard_shared_booking_slot BEFORE INSERT OR UPDATE ON public.trainer_blocked_slots
FOR EACH ROW EXECUTE FUNCTION public.guard_shared_booking_slot();
NOTIFY pgrst,'reload schema';
COMMIT;
