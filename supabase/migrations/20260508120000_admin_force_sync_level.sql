-- Admin-only: set profiles.member_level using auth.uid() (no separate p_admin_id).

CREATE OR REPLACE FUNCTION public.admin_force_sync_level(
  p_target_user uuid,
  p_new_level integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_level integer;
BEGIN
  IF p_new_level IS NULL OR p_new_level < 1 OR p_new_level > 10 THEN
    RAISE EXCEPTION 'invalid_level';
  END IF;

  IF auth.uid() IS NULL THEN
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

  v_level := least(10, greatest(1, p_new_level));

  UPDATE public.profiles
  SET member_level = v_level
  WHERE id = p_target_user;

  RETURN jsonb_build_object(
    'ok', true,
    'member_level', v_level,
    'target_user', p_target_user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_sync_level(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_sync_level(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.admin_force_sync_level IS 'Admin-only: set profiles.member_level; caller must be authenticated admin.';
