-- Migration 006: fix payments/notifications schema mismatches.
-- The payments table was renamed (user_id -> winner_user_id, amount ->
-- winning_bid, status -> payment_status, payment_proof_url ->
-- receipt_url) and fulfillment_type/shipping_address_id were dropped.
-- The notifications table was renamed too (type -> notification_type,
-- link -> related_auction_id). end_auction()/handle_new_bid() were
-- writing to columns that no longer exist, and the payments RLS
-- policies still filtered on the old user_id column.

-- Re-add a way to record which address a winner is shipping to (the
-- payments/[auctionId] page lets the winner pick a shipping_addresses
-- row, but there was nowhere to persist that choice).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS shipping_address_id BIGINT REFERENCES shipping_addresses(id);

-- Re-add a way to record the winner's chosen fulfillment method when the
-- auction's shipping_type is 'both' (shipping vs. self collection). This
-- is a payments-table-local concept, distinct from the fulfillment_type
-- column that used to live on auctions and was dropped in migration 004.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT;

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

CREATE OR REPLACE FUNCTION handle_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  auction_record RECORD;
  min_bid DECIMAL(12, 2);
BEGIN
  NEW.bid_amount := ROUND(NEW.bid_amount);

  SELECT * INTO auction_record FROM auctions WHERE id = NEW.auction_id FOR UPDATE;

  IF auction_record.status != 'active' THEN
    RAISE EXCEPTION 'Auction is not active';
  END IF;

  IF auction_record.end_at IS NOT NULL AND auction_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Auction has ended';
  END IF;

  min_bid := ROUND(COALESCE(auction_record.current_bid, auction_record.starting_price) + auction_record.minimum_increment);

  IF NEW.bid_amount < min_bid THEN
    RAISE EXCEPTION 'Bid must be at least %', min_bid;
  END IF;

  UPDATE auctions SET current_bid = NEW.bid_amount WHERE id = NEW.auction_id;

  INSERT INTO notifications (user_id, title, message, notification_type, related_auction_id)
  SELECT b.bidder_id, 'You have been outbid',
    'Someone placed a higher bid on ' || auction_record.title,
    'bid_outbid',
    NEW.auction_id
  FROM bids b
  WHERE b.auction_id = NEW.auction_id
    AND b.bidder_id != NEW.bidder_id
    AND b.bid_amount = (
      SELECT MAX(bid_amount) FROM bids WHERE auction_id = NEW.auction_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bid_created ON bids;
CREATE TRIGGER on_bid_created
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION handle_new_bid();

-- Fix payments RLS policies that still filtered on the old user_id column
DROP POLICY IF EXISTS "Users view own payments, admins view all" ON payments;
CREATE POLICY "Users view own payments, admins view all"
  ON payments FOR SELECT TO authenticated
  USING (winner_user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Winners can update own payments" ON payments;
CREATE POLICY "Winners can update own payments"
  ON payments FOR UPDATE TO authenticated
  USING (winner_user_id = auth.uid()) WITH CHECK (winner_user_id = auth.uid());

GRANT EXECUTE ON FUNCTION end_auction(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION end_expired_auctions() TO service_role;
GRANT EXECUTE ON FUNCTION activate_scheduled_auctions() TO service_role;
