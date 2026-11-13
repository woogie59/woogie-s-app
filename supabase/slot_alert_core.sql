-- LAB DOT slot-available notification. NEW objects only. Not applied to production.
-- User evidence: phonemsg-01M77Y9D0EQQ33753702SYFYYA, 2026-11-12.
-- No automatic booking, ticket deduction, existing data rewrite, or function DROP.
BEGIN;
CREATE TABLE public.slot_alert_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 slot_date date NOT NULL,
 slot_time text NOT NULL CHECK (slot_time ~ '^([01][0-9]|2[0-3]):00$'),
 state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','queued','notified','cancelled','expired','booked','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 CHECK ((state IN ('active','queued')) = (closed_at IS NULL))
);
CREATE UNIQUE INDEX slot_alert_one_live ON public.slot_alert_requests(user_id,slot_date,slot_time) WHERE state IN ('active','queued');
CREATE INDEX slot_alert_slot ON public.slot_alert_requests(slot_date,slot_time) WHERE state IN ('active','queued');
CREATE TABLE public.slot_alert_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.slot_alert_requests(id) ON DELETE CASCADE,
 vacancy_id uuid NOT NULL,
 released_at timestamptz,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','provider_accepted','skipped','failed')),
 attempts int NOT NULL DEFAULT 0,
 claim_token uuid,
 locked_at timestamptz,
 last_error text,
 provider_message_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 UNIQUE(request_id,vacancy_id)
);
CREATE INDEX slot_alert_pending ON public.slot_alert_jobs(created_at) WHERE state='pending';
ALTER TABLE public.slot_alert_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_alert_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.slot_alert_requests, public.slot_alert_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.slot_alert_requests TO authenticated;
GRANT ALL ON public.slot_alert_requests, public.slot_alert_jobs TO service_role;
CREATE POLICY slot_alert_own_read ON public.slot_alert_requests FOR SELECT TO authenticated USING (user_id=auth.uid());

-- Fail closed. Replace ONLY this new function with verified QA UUIDs for test release.
-- Full-member rollout requires separate owner approval. Do not select targets by display name.
CREATE FUNCTION public.slot_alert_enabled(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT false;
$$;
CREATE FUNCTION public.slot_alert_capabilities() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND public.slot_alert_enabled(auth.uid());
$$;
CREATE FUNCTION public.slot_alert_normal_time(p_time text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN btrim(p_time) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:00)?$'
 THEN lpad(split_part(btrim(p_time),':',1),2,'0') || ':' || split_part(btrim(p_time),':',2) ELSE NULL END;
$$;
CREATE FUNCTION public.slot_alert_allowed_time(p_date date,p_time text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE h int[]; today date := (now() AT TIME ZONE 'Asia/Seoul')::date; mon date;
BEGIN
 IF p_date IS NULL OR p_time IS NULL OR p_time !~ '^([01][0-9]|2[0-3]):00$' THEN RETURN false; END IF;
 IF (p_date::text || ' ' || p_time)::timestamp AT TIME ZONE 'Asia/Seoul' < now()+interval '1 hour' THEN RETURN false; END IF;
 mon := today - (extract(isodow FROM today)::int-1);
 IF p_date < today OR p_date > mon+13 THEN RETURN false; END IF;
 IF p_date>=mon+7 AND (now() AT TIME ZONE 'Asia/Seoul') < (mon+5)::timestamp+interval '13 hours' THEN RETURN false; END IF;
 -- Existing read-only schedule resolver. Its live signature/definition must be verified before apply.
 h := public._ot_available_hours(p_date);
 RETURN coalesce(substring(p_time,1,2)::int=ANY(h),false);
END;
$$;
CREATE FUNCTION public.slot_alert_free(p_date date,p_time text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.slot_alert_allowed_time(p_date,p_time)
 AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE left(btrim(b.date::text),10)=p_date::text AND public.slot_alert_normal_time(b.time)=p_time AND coalesce(b.status,'')<>'cancelled')
 AND NOT EXISTS (SELECT 1 FROM public.trainer_blocked_slots b WHERE b.block_date=p_date AND public.slot_alert_normal_time(b.block_time::text)=p_time);
$$;
CREATE FUNCTION public.slot_alert_register(p_date date,p_time text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); booking record; rid uuid;
BEGIN
 IF u IS NULL OR NOT public.slot_alert_enabled(u) THEN RETURN jsonb_build_object('ok',false,'reason','not_enabled'); END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=u AND coalesce(status,'active')='active') THEN RETURN jsonb_build_object('ok',false,'reason','inactive'); END IF;
 IF NOT public.slot_alert_allowed_time(p_date,p_time) THEN RETURN jsonb_build_object('ok',false,'reason','unavailable'); END IF;
 IF EXISTS (SELECT 1 FROM public.trainer_blocked_slots WHERE block_date=p_date AND public.slot_alert_normal_time(block_time::text)=p_time) THEN RETURN jsonb_build_object('ok',false,'reason','unavailable'); END IF;
 -- Lock occupied booking until registration commits, avoiding a lost cancellation between check and insert.
 SELECT id,user_id INTO booking FROM public.bookings WHERE left(btrim(date::text),10)=p_date::text AND public.slot_alert_normal_time(time)=p_time AND coalesce(status,'')<>'cancelled' ORDER BY id LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','already_available'); END IF;
 IF booking.user_id=u THEN RETURN jsonb_build_object('ok',false,'reason','own_booking'); END IF;
 SELECT id INTO rid FROM public.slot_alert_requests WHERE user_id=u AND slot_date=p_date AND slot_time=p_time AND state IN ('active','queued');
 IF rid IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'id',rid,'already_registered',true); END IF;
 INSERT INTO public.slot_alert_requests(user_id,slot_date,slot_time) VALUES(u,p_date,p_time) RETURNING id INTO rid;
 RETURN jsonb_build_object('ok',true,'id',rid);
EXCEPTION WHEN unique_violation THEN
 SELECT id INTO rid FROM public.slot_alert_requests WHERE user_id=u AND slot_date=p_date AND slot_time=p_time AND state IN ('active','queued');
 RETURN jsonb_build_object('ok',true,'id',rid,'already_registered',true);
END;
$$;
CREATE FUNCTION public.slot_alert_cancel(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.slot_alert_requests; in_flight boolean;
BEGIN
 SELECT * INTO r FROM public.slot_alert_requests WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
 SELECT EXISTS(SELECT 1 FROM public.slot_alert_jobs WHERE request_id=p_id AND state='sending') INTO in_flight;
 IF r.state IN ('active','queued') THEN
  UPDATE public.slot_alert_requests SET state='cancelled',closed_at=now() WHERE id=p_id;
  UPDATE public.slot_alert_jobs SET state='skipped',last_error='cancelled',closed_at=now() WHERE request_id=p_id AND state='pending';
 END IF;
 RETURN jsonb_build_object('ok',true,'may_already_be_sending',in_flight);
END;
$$;

-- No external calls here. Atomically queue EVERY registrant, with no priority or reservation.
CREATE FUNCTION public.slot_alert_booking_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d date; t text; vacancy uuid:=gen_random_uuid(); r record; became_free boolean:=false;
BEGIN
 IF TG_OP='INSERT' OR TG_OP='UPDATE' THEN
  IF coalesce(NEW.status,'')<>'cancelled' THEN
   UPDATE public.slot_alert_requests SET state='booked',closed_at=now()
    WHERE user_id=NEW.user_id AND slot_date=left(btrim(NEW.date::text),10)::date AND slot_time=public.slot_alert_normal_time(NEW.time) AND state IN ('active','queued');
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN became_free:=coalesce(OLD.status,'')<>'cancelled';
 ELSIF TG_OP='UPDATE' THEN
  became_free:=coalesce(OLD.status,'')<>'cancelled' AND (coalesce(NEW.status,'')='cancelled' OR left(btrim(OLD.date::text),10) IS DISTINCT FROM left(btrim(NEW.date::text),10) OR public.slot_alert_normal_time(OLD.time) IS DISTINCT FROM public.slot_alert_normal_time(NEW.time));
 END IF;
 IF became_free THEN
  d:=left(btrim(OLD.date::text),10)::date; t:=public.slot_alert_normal_time(OLD.time);
  IF public.slot_alert_free(d,t) THEN
   WITH picked AS (UPDATE public.slot_alert_requests SET state='queued' WHERE slot_date=d AND slot_time=t AND state='active' AND public.slot_alert_enabled(user_id) RETURNING id)
   INSERT INTO public.slot_alert_jobs(request_id,vacancy_id) SELECT id,vacancy FROM picked;
  END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN coalesce(NEW,OLD);
END;
$$;
CREATE TRIGGER slot_alert_booking_event AFTER INSERT OR DELETE OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.slot_alert_booking_event();

-- First claim checks vacancy once; that release covers ALL registrants of the event.
-- Later bookings cannot give only early recipients an alert. No caller chosen target/text.
CREATE FUNCTION public.slot_alert_claim(p_job uuid,p_claim uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.slot_alert_jobs; r public.slot_alert_requests;
BEGIN
 SELECT request_id,vacancy_id INTO j.request_id,j.vacancy_id FROM public.slot_alert_jobs WHERE id=p_job;
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- Serialize dispatch release within this vacancy, before locking individual requests/jobs.
 PERFORM pg_advisory_xact_lock(hashtextextended(j.vacancy_id::text,0));
 -- Same lock order as cancel: request first, then job.
 SELECT * INTO r FROM public.slot_alert_requests WHERE id=j.request_id FOR UPDATE;
 SELECT * INTO j FROM public.slot_alert_jobs WHERE id=p_job FOR UPDATE;
 IF j.state<>'pending' THEN RETURN NULL; END IF;
 IF j.attempts>=5 THEN
  UPDATE public.slot_alert_jobs SET state='failed',last_error='retry_exhausted',closed_at=now() WHERE id=p_job;
  IF r.state='queued' THEN UPDATE public.slot_alert_requests SET state='failed',closed_at=now() WHERE id=r.id; END IF;
  RETURN NULL;
 END IF;
 IF r.state<>'queued' OR NOT public.slot_alert_enabled(r.user_id) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=r.user_id AND coalesce(status,'active')='active') THEN
  UPDATE public.slot_alert_jobs SET state='skipped',last_error='ineligible',closed_at=now() WHERE id=p_job;
  IF r.state='queued' THEN UPDATE public.slot_alert_requests SET state='failed',closed_at=now() WHERE id=r.id; END IF;
  RETURN NULL;
 END IF;
 IF j.released_at IS NULL AND NOT public.slot_alert_free(r.slot_date,r.slot_time) THEN
  -- Resolve the WHOLE unreleased event before a subsequent cancellation can happen.
  -- Otherwise later worker batches could stay queued and miss that next cancellation.
  UPDATE public.slot_alert_requests sr SET state=CASE WHEN public.slot_alert_allowed_time(sr.slot_date,sr.slot_time) THEN 'active' ELSE 'expired' END,
    closed_at=CASE WHEN public.slot_alert_allowed_time(sr.slot_date,sr.slot_time) THEN NULL ELSE now() END
    WHERE sr.state='queued' AND EXISTS (SELECT 1 FROM public.slot_alert_jobs sj WHERE sj.request_id=sr.id AND sj.vacancy_id=j.vacancy_id AND sj.state='pending');
  UPDATE public.slot_alert_jobs SET state='skipped',last_error='slot_unavailable',closed_at=now() WHERE vacancy_id=j.vacancy_id AND state='pending';
  RETURN NULL;
 END IF;
 IF j.released_at IS NULL THEN
  UPDATE public.slot_alert_jobs SET released_at=now() WHERE vacancy_id=j.vacancy_id AND released_at IS NULL;
 END IF;
 UPDATE public.slot_alert_jobs SET state='sending',claim_token=p_claim,locked_at=now(),attempts=attempts+1 WHERE id=p_job;
 RETURN jsonb_build_object('user_id',r.user_id,'date',r.slot_date,'time',r.slot_time,'attempts',j.attempts+1);
END;
$$;
CREATE FUNCTION public.slot_alert_finish(p_job uuid,p_claim uuid,p_ok boolean,p_message uuid DEFAULT NULL,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.slot_alert_jobs; r public.slot_alert_requests; terminal boolean;
BEGIN
 SELECT request_id INTO j.request_id FROM public.slot_alert_jobs WHERE id=p_job;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO r FROM public.slot_alert_requests WHERE id=j.request_id FOR UPDATE;
 SELECT * INTO j FROM public.slot_alert_jobs WHERE id=p_job FOR UPDATE;
 IF j.state<>'sending' OR j.claim_token IS DISTINCT FROM p_claim THEN RETURN false; END IF;
 IF p_ok AND p_message IS NULL THEN RAISE EXCEPTION 'missing_provider_receipt'; END IF;
 terminal:=p_ok OR j.attempts>=5 OR r.state<>'queued';
 UPDATE public.slot_alert_jobs SET state=CASE WHEN p_ok THEN 'provider_accepted' WHEN terminal THEN 'failed' ELSE 'pending' END,
 provider_message_id=p_message,last_error=CASE WHEN p_ok THEN NULL ELSE left(p_error,60) END,
 claim_token=NULL,locked_at=NULL,closed_at=CASE WHEN terminal THEN now() ELSE NULL END WHERE id=p_job;
 IF r.state='queued' AND terminal THEN UPDATE public.slot_alert_requests SET state=CASE WHEN p_ok THEN 'notified' ELSE 'failed' END,closed_at=now() WHERE id=r.id; END IF;
 RETURN true;
END;
$$;
CREATE FUNCTION public.slot_alert_maintain() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.slot_alert_jobs SET state='pending',claim_token=NULL,locked_at=NULL WHERE state='sending' AND locked_at<now()-interval '5 minutes';
 UPDATE public.slot_alert_requests SET state='expired',closed_at=now() WHERE state IN ('active','queued') AND ((slot_date::text||' '||slot_time)::timestamp AT TIME ZONE 'Asia/Seoul')<now()+interval '1 hour';
 UPDATE public.slot_alert_jobs j SET state='skipped',last_error='request_closed',closed_at=now() FROM public.slot_alert_requests r WHERE j.request_id=r.id AND j.state='pending' AND r.state<>'queued';
 -- Authorized retention applies ONLY to these NEW tables. Never delete existing app data.
 DELETE FROM public.slot_alert_jobs WHERE closed_at<now()-interval '30 days';
 DELETE FROM public.slot_alert_requests WHERE closed_at<now()-interval '30 days';
END;
$$;
-- Revoke default function EXECUTE, then grant only the appropriate callers.
REVOKE ALL ON FUNCTION public.slot_alert_enabled(uuid),public.slot_alert_normal_time(text),public.slot_alert_allowed_time(date,text),public.slot_alert_free(date,text),public.slot_alert_booking_event(),public.slot_alert_claim(uuid,uuid),public.slot_alert_finish(uuid,uuid,boolean,uuid,text),public.slot_alert_maintain() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.slot_alert_capabilities(),public.slot_alert_register(date,text),public.slot_alert_cancel(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.slot_alert_capabilities(),public.slot_alert_register(date,text),public.slot_alert_cancel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slot_alert_claim(uuid,uuid),public.slot_alert_finish(uuid,uuid,boolean,uuid,text),public.slot_alert_maintain() TO service_role;
COMMIT;
