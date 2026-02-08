-- ==========================================
-- Admin RPC Function: Add Sessions and Update Price
-- ==========================================
-- This function allows admins to add sessions and update
-- price for any user, bypassing RLS policies
-- ==========================================

CREATE OR REPLACE FUNCTION admin_add_session_and_price(
    target_user_id UUID,
    sessions_to_add INT,
    new_price INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's privileges (bypasses RLS)
AS $$
DECLARE
    old_sessions INT;
    new_sessions INT;
    user_name TEXT;
BEGIN
    -- Fetch current data
    SELECT remaining_sessions, name
    INTO old_sessions, user_name
    FROM profiles
    WHERE id = target_user_id;

    -- Check if user exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Validate inputs
    IF sessions_to_add <= 0 THEN
        RAISE EXCEPTION 'Sessions to add must be greater than 0';
    END IF;

    IF new_price < 0 THEN
        RAISE EXCEPTION 'Price must be non-negative';
    END IF;

    -- Calculate new session count
    new_sessions := COALESCE(old_sessions, 0) + sessions_to_add;

    -- Update both fields in a single operation
    UPDATE profiles
    SET 
        remaining_sessions = new_sessions,
        price_per_session = new_price
    WHERE id = target_user_id;

    -- Return success with details
    RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id,
        'user_name', user_name,
        'sessions_added', sessions_to_add,
        'new_remaining', new_sessions,
        'new_price', new_price,
        'message', 'Sessions and price updated successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Return error details
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to update: ' || SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users
-- (In production, you might want to restrict this to admins only)
GRANT EXECUTE ON FUNCTION admin_add_session_and_price(UUID, INT, INT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION admin_add_session_and_price IS 'Admin function to add sessions and update price for any user, bypassing RLS';

-- ==========================================
-- VERIFICATION QUERY
-- ==========================================

-- Test the function (replace with actual UUID)
-- SELECT admin_add_session_and_price(
--     'USER_UUID_HERE'::UUID,
--     10,  -- sessions to add
--     50000  -- new price
-- );

-- Expected result:
-- {
--   "success": true,
--   "user_id": "uuid",
--   "user_name": "John Doe",
--   "sessions_added": 10,
--   "new_remaining": 15,
--   "new_price": 50000,
--   "message": "Sessions and price updated successfully"
-- }

-- ==========================================
-- CLEANUP (if needed)
-- ==========================================

-- DROP FUNCTION IF EXISTS admin_add_session_and_price(UUID, INT, INT);
