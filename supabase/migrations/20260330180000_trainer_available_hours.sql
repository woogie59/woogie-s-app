-- Time Block Matrix: replace start_time / end_time / break_times with available_hours (JSONB int[] 0–23)

CREATE OR REPLACE FUNCTION public._labdot_hhmm_to_minutes(t TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (NULLIF(trim(split_part($1, ':', 1)), '')::INT * 60
    + COALESCE(NULLIF(trim(split_part($1, ':', 2)), '')::INT, 0));
$$;

ALTER TABLE public.trainer_settings
  ADD COLUMN IF NOT EXISTS available_hours JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trainer_settings'
      AND column_name = 'start_time'
  ) THEN
    UPDATE public.trainer_settings AS ts
    SET available_hours = (
      SELECT COALESCE(jsonb_agg(h ORDER BY h), '[]'::jsonb)
      FROM generate_series(0, 23) AS h
      WHERE NOT ts.off
        AND (h * 60) >= public._labdot_hhmm_to_minutes(ts.start_time::text)
        AND (h * 60) < public._labdot_hhmm_to_minutes(ts.end_time::text)
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(ts.break_times, '[]'::jsonb)) AS bt
          WHERE (h * 60) >= public._labdot_hhmm_to_minutes(bt->>'start')
            AND (h * 60) < public._labdot_hhmm_to_minutes(bt->>'end')
        )
    );
  END IF;
END $$;

ALTER TABLE public.trainer_settings DROP COLUMN IF EXISTS start_time;
ALTER TABLE public.trainer_settings DROP COLUMN IF EXISTS end_time;
ALTER TABLE public.trainer_settings DROP COLUMN IF EXISTS break_times;

DROP FUNCTION IF EXISTS public._labdot_hhmm_to_minutes(TEXT);

COMMENT ON COLUMN public.trainer_settings.available_hours IS 'Active booking hours 0–23 (KST wall-clock hour starts), e.g. [9,10,14]';
