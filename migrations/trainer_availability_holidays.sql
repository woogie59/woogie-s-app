-- ==========================================
-- Trainer Availability & Holidays
-- ==========================================
-- trainer_availability: Recurring weekly off hours (e.g. Lunch 12-13, Sun off)
-- trainer_holidays: Specific dates (e.g. 2026-05-05) as full day off
-- ==========================================

-- trainer_availability: day_of_week 0=Sun, 1=Mon, ..., 6=Sat
CREATE TABLE IF NOT EXISTS trainer_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_day_off BOOLEAN DEFAULT false,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- trainer_holidays: specific dates off
CREATE TABLE IF NOT EXISTS trainer_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Allow read for authenticated, write for admins only
ALTER TABLE trainer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_holidays ENABLE ROW LEVEL SECURITY;

-- Everyone (including members) can read availability/holidays to see when they can book
CREATE POLICY "Anyone can read trainer_availability"
  ON trainer_availability FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage trainer_availability"
  ON trainer_availability FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read trainer_holidays"
  ON trainer_holidays FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage trainer_holidays"
  ON trainer_holidays FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

