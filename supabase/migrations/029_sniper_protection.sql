-- Migration 029: sniper protection (anti-snipe auto-extension).
--
-- Reuses the existing anti_snipe_enabled column as the per-auction on/off
-- toggle. All three anti_snipe_* columns were never created by any
-- migration (dashboard drift, pre-dating this migration history), and
-- anti_snipe_trigger_minutes/anti_snipe_extend_minutes were never read
-- anywhere -- confirmed via a repo-wide search before writing this
-- migration. Extension window/amount are fixed at 2 minutes globally per
-- product decision (not configurable per auction), so those two columns are
-- dropped here rather than kept as dead unread state.
--
-- Run in Supabase SQL Editor or via CLI.

-- ============================================================
-- 1. auctions: toggle column + new tracking columns
-- ============================================================

-- Defensive: create it if the dashboard-drift version of this column
-- somehow never made it to this database (harmless no-op otherwise).
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS anti_snipe_enabled BOOLEAN;

-- Backfill existing NULLs before enforcing NOT NULL.
UPDATE auctions SET anti_snipe_enabled = TRUE WHERE anti_snipe_enabled IS NULL;

ALTER TABLE auctions
  ALTER COLUMN anti_snipe_enabled SET DEFAULT TRUE,
  ALTER COLUMN anti_snipe_enabled SET NOT NULL;

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_end_at TIMESTAMPTZ;

-- Backfill original_end_at for auctions that predate this column.
UPDATE auctions SET original_end_at = end_at WHERE original_end_at IS NULL;

-- Dead columns from an earlier, abandoned per-auction-configurable attempt
-- at this same feature -- never created by a migration, never exposed in
-- the admin UI, never read server-side. Confirmed unreferenced anywhere
-- else in the codebase before dropping.
ALTER TABLE auctions
  DROP COLUMN IF EXISTS anti_snipe_trigger_minutes,
  DROP COLUMN IF EXISTS anti_snipe_extend_minutes;

-- ============================================================
-- 2. original_end_at: set once at creation, immutable afterward
-- ============================================================

CREATE OR REPLACE FUNCTION set_auction_original_end_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.original_end_at IS NULL THEN
    NEW.original_end_at := NEW.end_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auctions_set_original_end_at ON auctions;
CREATE TRIGGER auctions_set_original_end_at
  BEFORE INSERT ON auctions
  FOR EACH ROW EXECUTE FUNCTION set_auction_original_end_at();

CREATE OR REPLACE FUNCTION lock_auction_original_end_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.original_end_at := OLD.original_end_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auctions_lock_original_end_at ON auctions;
CREATE TRIGGER auctions_lock_original_end_at
  BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION lock_auction_original_end_at();

-- ============================================================
-- 3. handle_new_bid(): extend end_at on a last-minute bid
-- ============================================================
-- Reuses the row lock (`FOR UPDATE`) handle_new_bid() already takes on the
-- auction, which also serializes correctly against end_auction()'s own
-- `FOR UPDATE` -- an auction can't be closed out mid-extension.
--
-- Notification uses notification_type = 'auction_extended' as a plain TEXT
-- value (the notification_type enum was already dropped from the live DB
-- per migration 020's notes; no ALTER TYPE needed).

CREATE OR REPLACE FUNCTION handle_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  auction_record RECORD;
  min_bid DECIMAL(12, 2);
  v_new_end_at TIMESTAMPTZ;
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

  -- Sniper protection: bid landed within the last 2 minutes of the
  -- (possibly already-extended) end_at, and the auction has it enabled.
  IF auction_record.anti_snipe_enabled
     AND auction_record.end_at IS NOT NULL
     AND auction_record.end_at - NOW() <= INTERVAL '2 minutes' THEN

    UPDATE auctions
    SET end_at = end_at + INTERVAL '2 minutes',
        extension_count = extension_count + 1
    WHERE id = NEW.auction_id
    RETURNING end_at INTO v_new_end_at;

    INSERT INTO notifications (user_id, title, message, notification_type, related_auction_id)
    SELECT DISTINCT b.bidder_id, 'Auction extended',
      'The auction for ' || auction_record.title ||
        ' was extended by 2 minutes because a bid was placed near the closing time. New closing time: ' ||
        to_char(v_new_end_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'DD Mon YYYY, HH12:MI AM'),
      'auction_extended',
      NEW.auction_id
    FROM bids b
    WHERE b.auction_id = NEW.auction_id
      AND b.bidder_id != NEW.bidder_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bid_created ON bids;
CREATE TRIGGER on_bid_created
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION handle_new_bid();
