-- Migration 021: keep profiles.completed_wins / profiles.unpaid_wins in
-- sync with actual payment history.
--
-- Neither counter has ever been written to after being initialized to 0
-- by handle_new_user (migration 016). end_auction() creates a 'pending'
-- payment row for the winner but never touches unpaid_wins, and nothing
-- increments completed_wins when a payment is verified. The admin panel's
-- "Delivery Details"/winner dropdown reads these columns directly, so
-- every user has shown 0/0 regardless of real history.
--
-- This adds a trigger that keeps both counters current going forward
-- (unpaid_wins +1 when a payment is created as pending/submitted,
-- completed_wins +1 and unpaid_wins -1 the first time a payment becomes
-- verified), and backfills existing profiles from the current state of
-- `payments` so historical wins are reflected immediately.
--
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION sync_profile_win_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status IN ('pending', 'submitted') THEN
      UPDATE profiles SET unpaid_wins = unpaid_wins + 1 WHERE id = NEW.winner_user_id;
    ELSIF NEW.payment_status = 'verified' THEN
      UPDATE profiles SET completed_wins = completed_wins + 1 WHERE id = NEW.winner_user_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'verified' AND OLD.payment_status IN ('pending', 'submitted') THEN
      UPDATE profiles
      SET completed_wins = completed_wins + 1,
          unpaid_wins = GREATEST(unpaid_wins - 1, 0)
      WHERE id = NEW.winner_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_status_change ON payments;
CREATE TRIGGER on_payment_status_change
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION sync_profile_win_counts();

-- Backfill: recompute both counters from the current payments table so
-- existing wins/verifications made before this trigger existed show up
-- immediately, instead of only counting future changes.
UPDATE profiles p
SET
  completed_wins = COALESCE(
    (SELECT COUNT(*) FROM payments WHERE winner_user_id = p.id AND payment_status = 'verified'), 0
  ),
  unpaid_wins = COALESCE(
    (SELECT COUNT(*) FROM payments WHERE winner_user_id = p.id AND payment_status IN ('pending', 'submitted')), 0
  );
