-- Reliable section NEW badges: DB triggers + RPCs (idempotent re-run safe).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS athlete_board_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_board_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_growth_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_growth_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_titles_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_titles_seen_at timestamptz;

DROP FUNCTION IF EXISTS public.bump_athlete_board_updated(uuid);

CREATE OR REPLACE FUNCTION public.bump_athlete_board_updated(
  p_user_id uuid,
  p_section text DEFAULT 'all'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sec text := lower(trim(coalesce(p_section, 'all')));
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles
  SET
    athlete_board_updated_at = now(),
    athlete_growth_updated_at = CASE
      WHEN v_sec IN ('growth', 'level', 'all') THEN now()
      ELSE athlete_growth_updated_at
    END,
    athlete_titles_updated_at = CASE
      WHEN v_sec IN ('titles', 'title', 'all') THEN now()
      ELSE athlete_titles_updated_at
    END
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_athlete_board_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET athlete_board_seen_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'seen_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_athlete_growth_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET athlete_growth_seen_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_athlete_titles_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET athlete_titles_seen_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_athlete_board_updated(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_athlete_board_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_athlete_growth_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_athlete_titles_seen() TO authenticated;

-- Auto-bump when growth_records change (admin save level/comment)
CREATE OR REPLACE FUNCTION public.trg_bump_athlete_growth_from_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.bump_athlete_board_updated(NEW.user_id, 'growth');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_growth_records_bump ON public.growth_records;
CREATE TRIGGER athlete_growth_records_bump
  AFTER INSERT OR UPDATE ON public.growth_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_athlete_growth_from_record();

-- Auto-bump when member_titles change (admin grant/unlock)
CREATE OR REPLACE FUNCTION public.trg_bump_athlete_titles_from_member_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.bump_athlete_board_updated(NEW.user_id, 'titles');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_member_titles_bump ON public.member_titles;
CREATE TRIGGER athlete_member_titles_bump
  AFTER INSERT OR UPDATE ON public.member_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bump_athlete_titles_from_member_title();
