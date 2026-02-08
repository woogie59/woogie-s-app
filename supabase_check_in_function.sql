-- ==========================================
-- Task 1.1: QR Check-in RPC Function
-- ==========================================
-- This function handles the check-in process:
-- 1. Verifies user has remaining sessions (> 0)
-- 2. Decrements the session count by 1
-- 3. Returns success with updated count, or raises an error
-- ==========================================

CREATE OR REPLACE FUNCTION check_in_user(user_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_sessions INT;
  updated_sessions INT;
  user_name TEXT;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT remaining_sessions, name 
  INTO current_sessions, user_name
  FROM profiles
  WHERE id = user_uuid
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user has remaining sessions
  IF current_sessions IS NULL OR current_sessions <= 0 THEN
    RAISE EXCEPTION 'No remaining sessions available';
  END IF;

  -- Decrement the session count
  UPDATE profiles
  SET remaining_sessions = remaining_sessions - 1
  WHERE id = user_uuid
  RETURNING remaining_sessions INTO updated_sessions;

  -- Return success with user info
  RETURN json_build_object(
    'success', true,
    'user_id', user_uuid,
    'user_name', user_name,
    'remaining_sessions', updated_sessions,
    'message', 'Check-in successful'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Check-in failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_in_user(UUID) TO authenticated;

-- Optional: Create a check_ins log table to track all check-ins
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  remaining_sessions_after INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on check_ins
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own check-in history
CREATE POLICY "Users can view own check-ins"
  ON check_ins
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can view all check-ins
CREATE POLICY "Admins can view all check-ins"
  ON check_ins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Updated function with logging
CREATE OR REPLACE FUNCTION check_in_user(user_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_sessions INT;
  updated_sessions INT;
  user_name TEXT;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT remaining_sessions, name 
  INTO current_sessions, user_name
  FROM profiles
  WHERE id = user_uuid
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user has remaining sessions
  IF current_sessions IS NULL OR current_sessions <= 0 THEN
    RAISE EXCEPTION 'No remaining sessions available';
  END IF;

  -- Decrement the session count
  UPDATE profiles
  SET remaining_sessions = remaining_sessions - 1
  WHERE id = user_uuid
  RETURNING remaining_sessions INTO updated_sessions;

  -- Log the check-in
  INSERT INTO check_ins (user_id, remaining_sessions_after)
  VALUES (user_uuid, updated_sessions);

  -- Return success with user info
  RETURN json_build_object(
    'success', true,
    'user_id', user_uuid,
    'user_name', user_name,
    'remaining_sessions', updated_sessions,
    'message', 'Check-in successful'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Check-in failed: %', SQLERRM;
END;
$$;
