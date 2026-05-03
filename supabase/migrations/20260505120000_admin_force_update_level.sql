-- Secure admin-only path to set profiles.member_level (avoids direct client UPDATE under strict RLS).

CREATE OR REPLACE FUNCTION public.admin_force_update_level(
  p_target_user uuid,
  p_new_level integer,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF p_new_level IS NULL OR p_new_level < 1 THEN
    RAISE EXCEPTION 'invalid_level';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  UPDATE public.profiles
  SET member_level = p_new_level
  WHERE id = p_target_user;

  RETURN jsonb_build_object(
    'ok', true,
    'member_level', p_new_level,
    'target_user', p_target_user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_update_level(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_update_level(uuid, integer, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_force_update_level IS 'Admin-only: set profiles.member_level for a member. Caller must pass auth.uid() as p_admin_id.';
