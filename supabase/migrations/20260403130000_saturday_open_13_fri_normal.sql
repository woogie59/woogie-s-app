-- Friday: full day from 10:00 (not an early 13:00 experiment; no 9:00 slot).
-- Saturday: PT slots from 13:00 only (no 9–12).
UPDATE public.trainer_settings
SET
  available_hours = '[10,11,12,13,14,15,16,17,18,19,20,21]'::jsonb,
  updated_at = now()
WHERE day_of_week = 5;

UPDATE public.trainer_settings
SET
  available_hours = '[13,14,15,16,17,18,19,20,21]'::jsonb,
  updated_at = now()
WHERE day_of_week = 6;

COMMENT ON TABLE public.trainer_settings IS
  'Weekly availability. Saturday (6): sessions from 13:00 KST; other weekdays unchanged.';
