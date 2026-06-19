-- Isolate athlete board NEW badges by section.
-- Fixes: admin_save_growth_record (Apply) must NOT bump titles; triggers only fire on meaningful changes.

-- ── 1. Selective growth trigger (level / comments only) ─────────────────────

CREATE OR REPLACE FUNCTION public.trg_bump_athlete_growth_from_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_changed boolean := false;
  v_std_changed boolean := false;
  v_custom_changed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_athlete_board_updated(NEW.user_id, 'growth');
    RETURN NEW;
  END IF;

  -- UPDATE: detect level column variant
  IF to_regclass('public.growth_records') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'achieved_level'
    ) THEN
      v_level_changed := OLD.achieved_level IS DISTINCT FROM NEW.achieved_level;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'new_level'
    ) THEN
      v_level_changed := OLD.new_level IS DISTINCT FROM NEW.new_level;
    END IF;
  END IF;

  v_std_changed := OLD.standard_comment IS DISTINCT FROM NEW.standard_comment;
  v_custom_changed := OLD.custom_comment IS DISTINCT FROM NEW.custom_comment;

  IF v_level_changed OR v_std_changed OR v_custom_changed THEN
    PERFORM public.bump_athlete_board_updated(NEW.user_id, 'growth');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_growth_records_bump ON public.growth_records;
CREATE TRIGGER athlete_growth_records_bump
  AFTER INSERT OR UPDATE ON public.growth_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_athlete_growth_from_record();

-- ── 2. Selective titles trigger (grant / re-grant only, not revoke) ───────────

CREATE OR REPLACE FUNCTION public.trg_bump_athlete_titles_from_member_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_athlete_board_updated(NEW.user_id, 'titles');
    RETURN NEW;
  END IF;

  -- UPDATE: bump only when granted_at moves forward (re-grant), not on revoke/is_active-only edits
  IF NEW.granted_at IS NOT NULL AND (OLD.granted_at IS NULL OR NEW.granted_at > OLD.granted_at) THEN
    PERFORM public.bump_athlete_board_updated(NEW.user_id, 'titles');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_member_titles_bump ON public.member_titles;
CREATE TRIGGER athlete_member_titles_bump
  AFTER INSERT OR UPDATE ON public.member_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_athlete_titles_from_member_title();

-- ── 3. admin_save_growth_record — growth only, no title bump ────────────────
-- Replaces any version that called bump_athlete_board_updated(...) without p_section='growth'.

CREATE OR REPLACE FUNCTION public.admin_save_growth_record(
  p_target_user uuid,
  p_new_level integer,
  p_standard_comment text DEFAULT NULL,
  p_custom_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_level integer;
  v_has_achieved boolean;
  v_has_new_level boolean;
  v_std text := nullif(left(trim(coalesce(p_standard_comment, '')), 8000), '');
  v_custom text := nullif(left(trim(coalesce(p_custom_comment, '')), 8000), '');
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_admin;
  IF NOT v_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_target_user IS NULL THEN
    RAISE EXCEPTION 'missing_target';
  END IF;

  IF p_new_level IS NULL OR p_new_level < 1 OR p_new_level > 10 THEN
    RAISE EXCEPTION 'invalid_level';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  v_level := p_new_level;

  UPDATE public.profiles
  SET member_level = v_level
  WHERE id = p_target_user;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'achieved_level'
  ) INTO v_has_achieved;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'growth_records' AND column_name = 'new_level'
  ) INTO v_has_new_level;

  IF v_has_achieved THEN
    INSERT INTO public.growth_records (user_id, achieved_level, standard_comment, custom_comment)
    VALUES (p_target_user, v_level, v_std, v_custom);
  ELSIF v_has_new_level THEN
    INSERT INTO public.growth_records (user_id, new_level, standard_comment, custom_comment)
    VALUES (p_target_user, v_level, v_std, v_custom);
  ELSE
    RAISE EXCEPTION 'growth_records_schema_unsupported';
  END IF;

  -- growth_records INSERT trigger bumps athlete_growth_updated_at only (section = growth).
  -- Do NOT call bump_athlete_board_updated here — legacy calls without p_section default to 'all'.

  RETURN jsonb_build_object(
    'ok', true,
    'member_level', v_level,
    'target_user', p_target_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_growth_record(uuid, integer, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_save_growth_record IS
  'Admin: save level + comments to growth_records. NEW badge: growth section only (via trigger).';
