-- Title toggle must NOT bump growth NEW.
-- Legacy admin_toggle_sub_title often INSERTed into growth_records (칭호 획득 로그)
-- which fired athlete_growth_records_bump → growth_revision++.

CREATE OR REPLACE FUNCTION public.growth_record_is_title_only(p_row public.growth_records)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_j jsonb := to_jsonb(p_row);
  v_has_title_field boolean := false;
BEGIN
  v_has_title_field := (
    (v_j ? 'title_name' AND nullif(trim(coalesce(v_j->>'title_name', '')), '') IS NOT NULL)
    OR (v_j ? 'granted_title' AND nullif(trim(coalesce(v_j->>'granted_title', '')), '') IS NOT NULL)
    OR (v_j ? 'sub_title_name' AND nullif(trim(coalesce(v_j->>'sub_title_name', '')), '') IS NOT NULL)
    OR (v_j ? 'main_title_name' AND nullif(trim(coalesce(v_j->>'main_title_name', '')), '') IS NOT NULL)
    OR (v_j ? 'unlocked_main_title' AND nullif(trim(coalesce(v_j->>'unlocked_main_title', '')), '') IS NOT NULL)
  );

  IF NOT v_has_title_field THEN
    RETURN false;
  END IF;

  RETURN nullif(trim(coalesce(v_j->>'custom_comment', '')), '') IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_bump_athlete_growth_from_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_changed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.growth_record_is_title_only(NEW) THEN
      RETURN NEW;
    END IF;
    PERFORM public.bump_athlete_growth_board(NEW.user_id);
    RETURN NEW;
  END IF;

  IF public.growth_record_is_title_only(NEW) THEN
    RETURN NEW;
  END IF;

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

  IF v_level_changed
     OR OLD.standard_comment IS DISTINCT FROM NEW.standard_comment
     OR OLD.custom_comment IS DISTINCT FROM NEW.custom_comment THEN
    PERFORM public.bump_athlete_growth_board(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_growth_records_bump ON public.growth_records;
CREATE TRIGGER athlete_growth_records_bump
  AFTER INSERT OR UPDATE ON public.growth_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_athlete_growth_from_record();

CREATE OR REPLACE FUNCTION public.admin_toggle_sub_title(
  p_target_user  uuid,
  p_title_name   text,
  p_is_active    boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_title       text    := '';
  v_total_subs         bigint  := 0;
  v_active_subs        bigint  := 0;
  v_unlocked_main      text    := '';
  v_col_is_active      boolean := false;
  v_col_name           text    := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'member_titles' AND column_name = 'is_active'
  ) INTO v_col_is_active;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'title_definitions' AND column_name = 'name'
  ) THEN
    v_col_name := 'name';
  ELSE
    v_col_name := 'title';
  END IF;

  IF v_col_is_active THEN
    INSERT INTO public.member_titles (user_id, title, is_active, granted_at)
    VALUES (p_target_user, p_title_name, p_is_active, now())
    ON CONFLICT (user_id, title) DO UPDATE
      SET is_active  = EXCLUDED.is_active,
          granted_at = CASE
                         WHEN EXCLUDED.is_active THEN now()
                         ELSE public.member_titles.granted_at
                       END;
  ELSE
    IF p_is_active THEN
      INSERT INTO public.member_titles (user_id, title, granted_at)
      VALUES (p_target_user, p_title_name, now())
      ON CONFLICT (user_id, title) DO UPDATE SET granted_at = now();
    ELSE
      DELETE FROM public.member_titles
      WHERE user_id = p_target_user AND title = p_title_name;
    END IF;
  END IF;

  IF NOT p_is_active THEN
    RETURN v_unlocked_main;
  END IF;

  BEGIN
    EXECUTE format(
      'SELECT COALESCE(parent_title, '''') FROM public.title_definitions
       WHERE %I = $1 AND parent_title IS NOT NULL AND parent_title <> '''' LIMIT 1',
      v_col_name
    )
    INTO v_parent_title
    USING p_title_name;
  EXCEPTION WHEN OTHERS THEN
    v_parent_title := '';
  END;

  IF v_parent_title = '' OR v_parent_title IS NULL THEN
    RETURN v_unlocked_main;
  END IF;

  BEGIN
    EXECUTE format(
      'SELECT count(*) FROM public.title_definitions WHERE parent_title = $1 AND %I IS NOT NULL',
      v_col_name
    )
    INTO v_total_subs
    USING v_parent_title;
  EXCEPTION WHEN OTHERS THEN
    v_total_subs := 0;
  END;

  IF v_total_subs = 0 THEN
    RETURN v_unlocked_main;
  END IF;

  IF v_col_is_active THEN
    EXECUTE format(
      'SELECT count(*) FROM public.member_titles mt
       JOIN public.title_definitions td ON td.%I = mt.title
       WHERE mt.user_id = $1 AND td.parent_title = $2 AND mt.is_active = true',
      v_col_name
    )
    INTO v_active_subs
    USING p_target_user, v_parent_title;
  ELSE
    EXECUTE format(
      'SELECT count(*) FROM public.member_titles mt
       JOIN public.title_definitions td ON td.%I = mt.title
       WHERE mt.user_id = $1 AND td.parent_title = $2',
      v_col_name
    )
    INTO v_active_subs
    USING p_target_user, v_parent_title;
  END IF;

  IF v_active_subs >= v_total_subs THEN
    IF v_col_is_active THEN
      INSERT INTO public.member_titles (user_id, title, is_active, granted_at)
      VALUES (p_target_user, v_parent_title, true, now())
      ON CONFLICT (user_id, title) DO UPDATE SET is_active = true, granted_at = now();
    ELSE
      INSERT INTO public.member_titles (user_id, title, granted_at)
      VALUES (p_target_user, v_parent_title, now())
      ON CONFLICT (user_id, title) DO UPDATE SET granted_at = now();
    END IF;
    v_unlocked_main := v_parent_title;
  END IF;

  RETURN v_unlocked_main;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_sub_title(uuid, text, boolean) TO authenticated;
