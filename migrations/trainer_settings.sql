-- ==========================================
-- Trainer Settings: weekly availability as hour blocks (0–23)
-- ==========================================
-- day_of_week: 0=Sun, 1=Mon, ..., 6=Sat
-- off: true = full day off (ignore available_hours)
-- available_hours: JSON array of integers 0–23 (e.g. [9,10,14,15])
-- ==========================================

CREATE TABLE IF NOT EXISTS trainer_settings (
  day_of_week INT PRIMARY KEY CHECK (day_of_week >= 0 AND day_of_week <= 6),
  off BOOLEAN DEFAULT false,
  available_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trainer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trainer_settings"
  ON trainer_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage trainer_settings"
  ON trainer_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO trainer_settings (day_of_week, off, available_hours)
VALUES
  (0, true, '[]'::jsonb),
  (1, false, '[9,10,11,12,13,14,15,16,17,18,19,20,21]'::jsonb),
  (2, false, '[9,10,11,12,13,14,15,16,17,18,19,20,21]'::jsonb),
  (3, false, '[9,10,11,12,13,14,15,16,17,18,19,20,21]'::jsonb),
  (4, false, '[9,10,11,12,13,14,15,16,17,18,19,20,21]'::jsonb),
  (5, false, '[10,11,12,13,14,15,16,17,18,19,20,21]'::jsonb),
  (6, false, '[13,14,15,16,17,18,19,20,21]'::jsonb)
ON CONFLICT (day_of_week) DO NOTHING;
