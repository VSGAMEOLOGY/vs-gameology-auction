-- Enforce whole-number bid amounts at the database level.
-- Converts on_bid_created to a BEFORE trigger so NEW.amount can be rounded
-- before the row is written to the bids table.

CREATE OR REPLACE FUNCTION handle_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  auction_record RECORD;
  min_bid DECIMAL(12, 2);
BEGIN
  -- Round to nearest whole number (mirrors Math.round on the frontend)
  NEW.amount := ROUND(NEW.amount);

  SELECT * INTO auction_record FROM auctions WHERE id = NEW.auction_id FOR UPDATE;

  IF auction_record.status != 'active' THEN
    RAISE EXCEPTION 'Auction is not active';
  END IF;

  IF auction_record.end_time IS NOT NULL AND auction_record.end_time < NOW() THEN
    RAISE EXCEPTION 'Auction has ended';
  END IF;

  min_bid := ROUND(auction_record.current_price + auction_record.bid_increment);

  IF NEW.amount < min_bid THEN
    RAISE EXCEPTION 'Bid must be at least %', min_bid;
  END IF;

  UPDATE auctions SET current_price = NEW.amount WHERE id = NEW.auction_id;

  -- Notify the previous highest bidder (new row not yet inserted, so no id exclusion needed)
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT b.bidder_id, 'bid_outbid', 'You have been outbid',
    'Someone placed a higher bid on ' || auction_record.title,
    '/auctions/' || auction_record.id
  FROM bids b
  WHERE b.auction_id = NEW.auction_id
    AND b.bidder_id != NEW.bidder_id
    AND b.amount = (
      SELECT MAX(amount) FROM bids WHERE auction_id = NEW.auction_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate as BEFORE INSERT so we can mutate NEW.amount before storage
DROP TRIGGER IF EXISTS on_bid_created ON bids;
CREATE TRIGGER on_bid_created
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION handle_new_bid();
