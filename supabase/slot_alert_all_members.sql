-- Whole-member rollout approved by owner: phonemsg-01M79SPGBDBPXQ9WJ8M2YZY0EY.
-- Change only the NEW slot-alert gate; do not rewrite existing profiles or bookings.
BEGIN;
CREATE OR REPLACE FUNCTION public.slot_alert_enabled(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user AND role='user' AND coalesce(status,'active')='active');
$$;
COMMIT;
