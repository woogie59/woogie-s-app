-- Master exam apply: robust level check on profiles.member_level (handles string/numeric mismatch).
-- Call from client: supabase.rpc('apply_for_master_exam', { p_target_user: '<uuid>' })

CREATE OR REPLACE FUNCTION public.apply_for_master_exam(p_target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level int;
BEGIN
  IF p_target_user IS NULL THEN
    RAISE EXCEPTION '대상 사용자가 지정되지 않았습니다.';
  END IF;

  SELECT FLOOR(COALESCE(p.member_level::numeric, 0))::int
  INTO v_level
  FROM public.profiles AS p
  WHERE p.id = p_target_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다.';
  END IF;

  IF v_level < 10 THEN
    RAISE EXCEPTION '레벨을 충족하지 못했습니다. (현재 Lv. %)', v_level;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.master_exam_requests AS r
    WHERE r.user_id = p_target_user
      AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION '이미 심사 대기 중입니다.';
  END IF;

  INSERT INTO public.master_exam_requests (user_id, status)
  VALUES (p_target_user, 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_for_master_exam(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_for_master_exam(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_master_exam(uuid) TO service_role;

COMMENT ON FUNCTION public.apply_for_master_exam(uuid) IS
  'Member applies for master exam; validates profiles.member_level >= 10 using numeric cast; inserts pending row.';
