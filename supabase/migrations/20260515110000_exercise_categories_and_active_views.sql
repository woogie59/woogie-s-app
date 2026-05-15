-- ── exercise_categories ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercise_categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text        UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Pre-populate with existing hardcoded body-part values
INSERT INTO public.exercise_categories (label) VALUES
  ('가슴'), ('등'), ('하체'), ('어깨'), ('팔'), ('코어'), ('전신')
ON CONFLICT (label) DO NOTHING;

-- RLS: allow all authenticated users to read; only admins write (admin check handled in app layer)
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_categories_select" ON public.exercise_categories
  FOR SELECT USING (true);

CREATE POLICY "exercise_categories_insert" ON public.exercise_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "exercise_categories_delete" ON public.exercise_categories
  FOR DELETE USING (true);

-- ── posts.active_views ────────────────────────────────────────────────────────
-- Stores which anatomy views are relevant (e.g. ARRAY['front'] or ARRAY['front','back'])
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS active_views text[] DEFAULT ARRAY['front'];
