-- Admin training report save: decrement one session (FIFO session_batches, else profiles.remaining_sessions).
-- Callable only by authenticated users with profiles.role = 'admin'.

CREATE OR REPLACE FUNCTION public.admin_decrement_session_for_report(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch_id uuid;
  rem_profile int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_member');
  END IF;

  SELECT id INTO batch_id
  FROM public.session_batches
  WHERE user_id = p_member_id AND remaining_count > 0
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF batch_id IS NOT NULL THEN
    UPDATE public.session_batches
    SET remaining_count = remaining_count - 1
    WHERE id = batch_id;
    RETURN jsonb_build_object('ok', true, 'via', 'batch');
  END IF;

  SELECT COALESCE(remaining_sessions, 0) INTO rem_profile
  FROM public.profiles
  WHERE id = p_member_id;

  IF rem_profile IS NULL OR rem_profile < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_sessions');
  END IF;

  UPDATE public.profiles
  SET remaining_sessions = remaining_sessions - 1
  WHERE id = p_member_id;

  RETURN jsonb_build_object('ok', true, 'via', 'profile');
END;
$$;

COMMENT ON FUNCTION public.admin_decrement_session_for_report(uuid) IS
  'Admin-only: consume one session after saving a training report (FIFO packs, else legacy remaining_sessions).';

GRANT EXECUTE ON FUNCTION public.admin_decrement_session_for_report(uuid) TO authenticated;
