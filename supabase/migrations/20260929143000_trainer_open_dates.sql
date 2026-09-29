-- Date-specific OPEN override. Weekly trainer_settings stays the default;
-- this table opens one calendar date without turning on every matching weekday.

CREATE TABLE IF NOT EXISTS public.trainer_open_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  available_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trainer_open_dates_date_idx
  ON public.trainer_open_dates (date);

ALTER TABLE public.trainer_open_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read trainer_open_dates" ON public.trainer_open_dates;
CREATE POLICY "Anyone can read trainer_open_dates"
  ON public.trainer_open_dates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage trainer_open_dates" ON public.trainer_open_dates;
CREATE POLICY "Admins manage trainer_open_dates"
  ON public.trainer_open_dates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_open_dates TO authenticated;

COMMENT ON TABLE public.trainer_open_dates IS
  'Open one calendar date even when weekly trainer_settings has that weekday off. Mutually exclusive with trainer_holidays for the same date.';
