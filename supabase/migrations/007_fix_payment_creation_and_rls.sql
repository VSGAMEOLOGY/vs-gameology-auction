-- Migration 007: fix end_auction() not creating payment/notification rows,
-- and close RLS gaps found by the Supabase advisor.
--
-- Migration 006 rewrote end_auction()/handle_new_bid() to write to the
-- live payments/notifications schema, but that migration was never run
-- against the live database -- auctions 9, 10 and 11 all ended with a
-- winner and zero rows were ever inserted into payments/notifications.
-- This re-applies the fix (idempotent) so future auction endings work,
-- and the missing rows for already-ended auctions have been backfilled
-- separately via the API.
--
-- It also enables RLS on business_settings, auction_winners and
-- user_suspensions -- none of these were ever covered by a prior
-- migration's RLS statements (business_settings was created manually
-- with a different schema than migration 004 assumed, and
-- auction_winners/user_suspensions aren't referenced by any migration
-- at all), which is what the Supabase advisor is flagging.

CREATE OR REPLACE FUNCTION end_auction(p_auction_id BIGINT)
RETURNS VOID AS $$
DECLARE
  auction_record RECORD;
  winning_bid RECORD;
  v_due_hours INTEGER;
  v_shipping_fee DECIMAL(12, 2);
BEGIN
  SELECT * INTO auction_record FROM auctions WHERE id = p_auction_id FOR UPDATE;

  IF auction_record.status NOT IN ('active', 'scheduled') THEN
    RETURN;
  END IF;

  SELECT * INTO winning_bid FROM bids
  WHERE auction_id = p_auction_id
  ORDER BY bid_amount DESC, created_at ASC
  LIMIT 1;

  IF winning_bid IS NOT NULL THEN
    UPDATE auctions SET
      status = 'ended',
      winner_user_id = winning_bid.bidder_id,
      current_bid = winning_bid.bid_amount
    WHERE id = p_auction_id;

    UPDATE bids SET is_winning = TRUE WHERE id = winning_bid.id;

    SELECT payment_due_hours INTO v_due_hours FROM business_settings LIMIT 1;
    v_shipping_fee := CASE WHEN auction_record.shipping_type = 'collection'
      THEN 0 ELSE COALESCE(auction_record.shipping_fee_west, 0) END;

    INSERT INTO payments (auction_id, winner_user_id, winning_bid, shipping_fee, total_amount, payment_status, payment_due_at)
    VALUES (
      p_auction_id,
      winning_bid.bidder_id,
      winning_bid.bid_amount,
      v_shipping_fee,
      winning_bid.bid_amount + v_shipping_fee,
      'pending',
      NOW() + (COALESCE(v_due_hours, 24) || ' hours')::INTERVAL
    );

    INSERT INTO notifications (user_id, title, message, notification_type, related_auction_id)
    VALUES (
      winning_bid.bidder_id,
      'Congratulations! You won the auction',
      'You won: ' || auction_record.title || '. Please complete payment.',
      'auction_won',
      p_auction_id
    );
  ELSE
    UPDATE auctions SET status = 'ended' WHERE id = p_auction_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION end_auction(BIGINT) TO service_role;

-- ============================================================
-- RLS gaps flagged by the Supabase advisor
-- ============================================================

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read business settings" ON business_settings;
DROP POLICY IF EXISTS "Authenticated users can read business settings" ON business_settings;
DROP POLICY IF EXISTS "Admins can manage business settings" ON business_settings;

CREATE POLICY "Authenticated users can read business settings"
  ON business_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage business settings"
  ON business_settings FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE auction_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage auction winners" ON auction_winners;
CREATE POLICY "Admins manage auction winners"
  ON auction_winners FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE user_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage user suspensions" ON user_suspensions;
CREATE POLICY "Admins manage user suspensions"
  ON user_suspensions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users view own suspensions" ON user_suspensions;
CREATE POLICY "Users view own suspensions"
  ON user_suspensions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
