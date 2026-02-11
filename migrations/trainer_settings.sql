-- ==========================================
-- Trainer Settings: Weekly schedule per day
-- ==========================================
-- day_of_week: 0=Sun, 1=Mon, ..., 6=Sat
-- off: true = full day off
-- start_time, end_time: working hours for that day
-- break_times: JSONB array of {start, end} e.g. [{"start":"12:00","end":"13:00"}]
-- ==========================================

CREATE TABLE IF NOT EXISTS trainer_settings (
  day_of_week INT PRIMARY KEY CHECK (day_of_week >= 0 AND day_of_week <= 6),
  off BOOLEAN DEFAULT false,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '22:00',
  break_times JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trainer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trainer_settings"
  ON trainer_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage trainer_settings"
  ON trainer_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed default rows for all 7 days
INSERT INTO trainer_settings (day_of_week, off, start_time, end_time)
VALUES
  (0, true, '09:00', '22:00'),   -- Sun: off
  (1, false, '09:00', '22:00'),
  (2, false, '09:00', '22:00'),
  (3, false, '09:00', '22:00'),
  (4, false, '09:00', '22:00'),
  (5, false, '09:00', '22:00'),
  (6, false, '09:00', '22:00')
ON CONFLICT (day_of_week) DO NOTHING;
