-- Fix: admin_upsert_title_description was declared with v_id bigint but
-- title_definitions.id is a UUID, causing "invalid input syntax for type bigint" errors.
-- Re-create the function with the correct uuid type.
CREATE OR REPLACE FUNCTION admin_upsert_title_description(
  p_title_name text,
  p_description text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Try 'name' column first, fall back to 'title' column
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
    INSERT INTO title_definitions (name, description)
    VALUES (p_title_name, p_description)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_title_description(text, text) TO authenticated;
