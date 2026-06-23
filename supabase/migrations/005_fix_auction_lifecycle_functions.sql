-- Migration 005: fix auto-end/auto-activate cron functions and bid trigger.
-- The functions shipped in 001/003 still reference the original column
-- names (start_time, end_time, current_price, bid_increment, amount,
-- reserve_price, fulfillment_type/shipping_fee on auctions). The live
-- schema has since moved to start_at, end_at, current_bid,
-- minimum_increment, bid_amount, winner_user_id, shipping_type,
-- shipping_fee_west/east — so pg_cron's calls to these functions were
-- silently no-ops and auctions never transitioned out of "active".

-- Activate scheduled auctions whose start time has arrived
CREATE OR REPLACE FUNCTION activate_scheduled_auctions()
RETURNS VOID AS $$
BEGIN
  UPDATE auctions
  SET status = 'active', current_bid = starting_price
  WHERE status = 'scheduled'
    AND start_at <= NOW()
    AND (end_at IS NULL OR end_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End a single auction and select its winner
CREATE OR REPLACE FUNCTION end_auction(p_auction_id UUID)
RETURNS VOID AS $$
DECLARE
  auction_record RECORD;
  winning_bid RECORD;
  v_fulfillment fulfillment_type;
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

    v_fulfillment := CASE WHEN auction_record.shipping_type = 'collection'
      THEN 'collection' ELSE 'shipping' END;
    v_shipping_fee := CASE WHEN v_fulfillment = 'collection'
      THEN 0 ELSE COALESCE(auction_record.shipping_fee_west, 0) END;

    INSERT INTO payments (auction_id, user_id, amount, shipping_fee, total_amount, fulfillment_type)
    VALUES (
      p_auction_id,
      winning_bid.bidder_id,
      winning_bid.bid_amount,
      v_shipping_fee,
      winning_bid.bid_amount + v_shipping_fee,
      v_fulfillment
    );

    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      winning_bid.bidder_id,
      'auction_won',
      'Congratulations! You won the auction',
      'You won: ' || auction_record.title || '. Please complete payment.',
      '/payments/' || p_auction_id
    );
  ELSE
    UPDATE auctions SET status = 'ended' WHERE id = p_auction_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End auctions whose end time has passed
CREATE OR REPLACE FUNCTION end_expired_auctions()
RETURNS VOID AS $$
DECLARE
  v_auction_id UUID;
BEGIN
  FOR v_auction_id IN
    SELECT id FROM auctions
    WHERE status = 'active' AND end_at IS NOT NULL AND end_at <= NOW()
  LOOP
    PERFORM end_auction(v_auction_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate bids against the live schema and reject bids on non-active auctions
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

  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT b.bidder_id, 'bid_outbid', 'You have been outbid',
    'Someone placed a higher bid on ' || auction_record.title,
    '/auctions/' || auction_record.id
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

GRANT EXECUTE ON FUNCTION activate_scheduled_auctions() TO service_role;
GRANT EXECUTE ON FUNCTION end_expired_auctions() TO service_role;
GRANT EXECUTE ON FUNCTION end_auction(UUID) TO service_role;
