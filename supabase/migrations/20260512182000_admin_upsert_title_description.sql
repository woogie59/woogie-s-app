-- Admin-only RPC to save a title description, bypassing RLS.
-- Direct UPDATE on title_definitions is blocked for authenticated users by default RLS;
-- SECURITY DEFINER allows this function to run with the permissions of its creator (superuser).
CREATE OR REPLACE FUNCTION admin_upsert_title_description(
  p_title_name text,
  p_description text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  -- Try 'name' column first (preferred), fall back to 'title' column
  BEGIN
    SELECT id INTO v_id
    FROM title_definitions
    WHERE name = p_title_name
    LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    v_id := NULL;
  END;

  IF v_id IS NULL THEN
    BEGIN
      SELECT id INTO v_id
      FROM title_definitions
      WHERE title = p_title_name
      LIMIT 1;
    EXCEPTION WHEN undefined_column THEN
      v_id := NULL;
    END;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE title_definitions SET description = p_description WHERE id = v_id;
  ELSE
    -- Row not yet created; insert a minimal placeholder row
    INSERT INTO title_definitions (name, description)
    VALUES (p_title_name, p_description)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_title_description(text, text) TO authenticated;
