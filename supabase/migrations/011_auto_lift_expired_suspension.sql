-- Migration 011: let a user's own request lift their expired temporary
-- suspension. user_suspensions only allows admins to write rows, so a
-- plain client-side UPDATE from the suspended user's session can't mark
-- it lifted -- this SECURITY DEFINER function does it safely, scoped to
-- auth.uid()'s own active suspension.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION lift_expired_suspension()
RETURNS BOOLEAN AS $$
DECLARE
  v_suspension RECORD;
BEGIN
  SELECT id, suspension_type, suspended_until INTO v_suspension
  FROM user_suspensions
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_suspension.id IS NOT NULL
     AND v_suspension.suspension_type = 'temporary'
     AND v_suspension.suspended_until IS NOT NULL
     AND v_suspension.suspended_until <= NOW() THEN
    UPDATE user_suspensions SET is_active = false WHERE id = v_suspension.id;
    UPDATE profiles SET status = 'active' WHERE id = auth.uid();
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION lift_expired_suspension() TO authenticated;
