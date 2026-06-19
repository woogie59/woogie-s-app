-- Date-specific slot holds (OT / internal) — weekly trainer_settings unchanged.

CREATE TABLE IF NOT EXISTS public.trainer_blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_date date NOT NULL,
  block_time text NOT NULL,
  label text NOT NULL DEFAULT 'OT',
  kind text NOT NULL DEFAULT 'ot' CHECK (kind IN ('ot', 'internal', 'hold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT trainer_blocked_slots_time_format CHECK (block_time ~ '^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE UNIQUE INDEX IF NOT EXISTS trainer_blocked_slots_date_time_unique
  ON public.trainer_blocked_slots (block_date, block_time);

CREATE INDEX IF NOT EXISTS trainer_blocked_slots_date_idx
  ON public.trainer_blocked_slots (block_date);

ALTER TABLE public.trainer_blocked_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read trainer_blocked_slots" ON public.trainer_blocked_slots;
CREATE POLICY "Anyone can read trainer_blocked_slots"
  ON public.trainer_blocked_slots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage trainer_blocked_slots" ON public.trainer_blocked_slots;
CREATE POLICY "Admins manage trainer_blocked_slots"
  ON public.trainer_blocked_slots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_blocked_slots TO authenticated;

COMMENT ON TABLE public.trainer_blocked_slots IS
  'Admin holds a specific date+time (OT etc.). Members cannot book; does not affect weekly trainer_settings.';
