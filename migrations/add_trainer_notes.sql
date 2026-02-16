-- trainer_notes: Private CRM notes for admins (e.g., golden time analysis, retention strategy)
CREATE TABLE IF NOT EXISTS trainer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_notes_user_id ON trainer_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_notes_created_at ON trainer_notes(created_at DESC);

ALTER TABLE trainer_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write trainer notes
CREATE POLICY "Admins can manage trainer notes"
  ON trainer_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
