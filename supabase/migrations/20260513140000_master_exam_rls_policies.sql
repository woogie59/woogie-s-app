-- Fix: master_exam_requests had no RLS SELECT policy, causing the Admin Queue
-- and the Hall of Fame Leaderboard to receive empty data silently.
--
-- Admins need SELECT to manage the exam queue.
-- Authenticated users need SELECT to check their own exam status and for the leaderboard.

-- Allow all authenticated users to read master_exam_requests.
-- The data does not contain PII beyond user_id and status, so this is safe.
CREATE POLICY "authenticated users can read master exam requests"
  ON public.master_exam_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert their own exam requests.
-- (Handles the case where no INSERT policy exists.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'master_exam_requests'
      AND cmd        = 'INSERT'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "users can submit their own exam requests"
        ON public.master_exam_requests
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END
$$;
