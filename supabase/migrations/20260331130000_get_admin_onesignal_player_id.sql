-- Clients need admin OneSignal player id for notify-admin-events; direct SELECT on profiles is often blocked by RLS.
CREATE OR REPLACE FUNCTION public.get_admin_onesignal_player_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT onesignal_id
  FROM public.profiles
  WHERE role = 'admin' AND onesignal_id IS NOT NULL
  ORDER BY 1
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_admin_onesignal_player_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_onesignal_player_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_onesignal_player_id() TO anon;
