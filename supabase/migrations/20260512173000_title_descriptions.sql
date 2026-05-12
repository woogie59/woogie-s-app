-- Ensure title description columns exist for UI bindings/tooltips.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'title_definitions'
  ) THEN
    ALTER TABLE public.title_definitions
      ADD COLUMN IF NOT EXISTS description text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'titles'
  ) THEN
    ALTER TABLE public.titles
      ADD COLUMN IF NOT EXISTS description text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'title_sets'
  ) THEN
    ALTER TABLE public.title_sets
      ADD COLUMN IF NOT EXISTS description text;
  END IF;
END
$$;
