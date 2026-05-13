-- Fix: admin_toggle_sub_title was auto-equipping the newly unlocked Main Title
-- by updating profiles.current_title / profiles.representative_title_id as a side-effect.
-- The ONLY correct place to equip a title is via the explicit "장착하기" (Equip) button.
--
-- This migration replaces the function with an identical version that:
--   1. Toggles sub-title ownership in member_titles (grant / revoke).
--   2. Unlocks the parent Main Title in member_titles when all sub-titles are granted.
--   3. NEVER touches profiles.current_title or profiles.representative_title_id.

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
  v_col_name           text    := '';   -- 'name' or 'title' column in title_definitions
BEGIN
  -- ── 1. Detect schema variants ──────────────────────────────────────────────

  -- Does member_titles have an `is_active` column?
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'member_titles'
      AND column_name  = 'is_active'
  ) INTO v_col_is_active;

  -- Does title_definitions use 'name' or 'title' for the title text?
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'title_definitions'
      AND column_name  = 'name'
  ) THEN
    v_col_name := 'name';
  ELSE
    v_col_name := 'title';
  END IF;

  -- ── 2. Toggle the sub-title in member_titles ───────────────────────────────

  IF v_col_is_active THEN
    -- Schema has is_active column: upsert the flag
    INSERT INTO public.member_titles (user_id, title, is_active, granted_at)
    VALUES (p_target_user, p_title_name, p_is_active, now())
    ON CONFLICT (user_id, title) DO UPDATE
      SET is_active  = EXCLUDED.is_active,
          granted_at = CASE
                         WHEN EXCLUDED.is_active THEN now()
                         ELSE public.member_titles.granted_at
                       END;
  ELSE
    -- Schema uses row presence: insert when granting, delete when revoking
    IF p_is_active THEN
      INSERT INTO public.member_titles (user_id, title, granted_at)
      VALUES (p_target_user, p_title_name, now())
      ON CONFLICT (user_id, title) DO UPDATE
        SET granted_at = now();
    ELSE
      DELETE FROM public.member_titles
      WHERE user_id = p_target_user
        AND title   = p_title_name;
    END IF;
  END IF;

  -- ── 3. Only proceed if we're granting (activating) ────────────────────────
  IF NOT p_is_active THEN
    RETURN v_unlocked_main;
  END IF;

  -- ── 4. Look up the parent Main Title ──────────────────────────────────────
  BEGIN
    EXECUTE format(
      'SELECT COALESCE(parent_title, '''') FROM public.title_definitions
       WHERE %I = $1
         AND parent_title IS NOT NULL
         AND parent_title <> ''''
       LIMIT 1',
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

  -- ── 5. Check if ALL sub-titles for this Main Title are now granted ─────────
  BEGIN
    EXECUTE format(
      'SELECT count(*) FROM public.title_definitions
       WHERE parent_title = $1
         AND %I IS NOT NULL',
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
      'SELECT count(*)
       FROM public.member_titles mt
       JOIN public.title_definitions td ON td.%I = mt.title
       WHERE mt.user_id   = $1
         AND td.parent_title = $2
         AND mt.is_active = true',
      v_col_name
    )
    INTO v_active_subs
    USING p_target_user, v_parent_title;
  ELSE
    EXECUTE format(
      'SELECT count(*)
       FROM public.member_titles mt
       JOIN public.title_definitions td ON td.%I = mt.title
       WHERE mt.user_id      = $1
         AND td.parent_title = $2',
      v_col_name
    )
    INTO v_active_subs
    USING p_target_user, v_parent_title;
  END IF;

  -- ── 6. Unlock Main Title in member_titles ONLY ────────────────────────────
  --       ❌ We do NOT touch profiles.current_title
  --       ❌ We do NOT touch profiles.representative_title_id
  --       The user equips a title explicitly via the "장착하기" button.
  IF v_active_subs >= v_total_subs THEN
    IF v_col_is_active THEN
      INSERT INTO public.member_titles (user_id, title, is_active, granted_at)
      VALUES (p_target_user, v_parent_title, true, now())
      ON CONFLICT (user_id, title) DO UPDATE
        SET is_active  = true,
            granted_at = now();
    ELSE
      INSERT INTO public.member_titles (user_id, title, granted_at)
      VALUES (p_target_user, v_parent_title, now())
      ON CONFLICT (user_id, title) DO UPDATE
        SET granted_at = now();
    END IF;

    v_unlocked_main := v_parent_title;
  END IF;

  RETURN v_unlocked_main;
END;
$$;

-- Grant execute permission to authenticated users who call this as admins.
GRANT EXECUTE ON FUNCTION public.admin_toggle_sub_title(uuid, text, boolean)
  TO authenticated;
