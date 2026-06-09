-- VS GAMEOLOGY Auction Platform - Initial Schema
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE auction_status AS ENUM ('draft', 'scheduled', 'active', 'ended', 'cancelled');
CREATE TYPE fulfillment_type AS ENUM ('shipping', 'collection');
CREATE TYPE payment_status AS ENUM ('pending', 'submitted', 'verified', 'rejected', 'refunded');
CREATE TYPE notification_type AS ENUM (
  'bid_outbid', 'auction_won', 'auction_ending', 'payment_verified',
  'payment_rejected', 'account_suspended', 'general'
);
CREATE TYPE suspension_type AS ENUM ('temporary', 'permanent');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason TEXT,
  suspended_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipping addresses
CREATE TABLE shipping_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  recipient_name TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'AU',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blacklist
CREATE TABLE blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blacklisted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auctions
CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  starting_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  reserve_price DECIMAL(12, 2),
  current_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  bid_increment DECIMAL(12, 2) NOT NULL DEFAULT 1,
  shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  fulfillment_type fulfillment_type NOT NULL DEFAULT 'shipping',
  status auction_status NOT NULL DEFAULT 'draft',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  winner_id UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bids
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Watchlist
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, auction_id)
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  fulfillment_type fulfillment_type NOT NULL DEFAULT 'shipping',
  shipping_address_id UUID REFERENCES shipping_addresses(id),
  status payment_status NOT NULL DEFAULT 'pending',
  payment_proof_url TEXT,
  admin_notes TEXT,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(auction_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin activity logs
CREATE TABLE admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Suspension history
CREATE TABLE suspension_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suspended_by UUID NOT NULL REFERENCES profiles(id),
  type suspension_type NOT NULL,
  reason TEXT NOT NULL,
  suspended_until TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_start_time ON auctions(start_time);
CREATE INDEX idx_auctions_end_time ON auctions(end_time);
CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_bidder_id ON bids(bidder_id);
CREATE INDEX idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_shipping_addresses_user_id ON shipping_addresses(user_id);
CREATE INDEX idx_admin_logs_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX idx_admin_logs_created_at ON admin_activity_logs(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER shipping_addresses_updated_at BEFORE UPDATE ON shipping_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER auctions_updated_at BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM blacklist WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'This email is blacklisted and cannot register';
  END IF;

  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure only one default shipping address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE shipping_addresses
    SET is_default = FALSE
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipping_address_default_trigger
  BEFORE INSERT OR UPDATE ON shipping_addresses
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_address();

-- Update auction current price on new bid
CREATE OR REPLACE FUNCTION handle_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  auction_record RECORD;
BEGIN
  SELECT * INTO auction_record FROM auctions WHERE id = NEW.auction_id FOR UPDATE;

  IF auction_record.status != 'active' THEN
    RAISE EXCEPTION 'Auction is not active';
  END IF;

  IF auction_record.end_time IS NOT NULL AND auction_record.end_time < NOW() THEN
    RAISE EXCEPTION 'Auction has ended';
  END IF;

  IF NEW.amount < auction_record.current_price + auction_record.bid_increment THEN
    RAISE EXCEPTION 'Bid must be at least %', auction_record.current_price + auction_record.bid_increment;
  END IF;

  UPDATE auctions SET current_price = NEW.amount WHERE id = NEW.auction_id;

  -- Notify previous highest bidder
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT b.bidder_id, 'bid_outbid', 'You have been outbid',
    'Someone placed a higher bid on ' || auction_record.title,
    '/auctions/' || auction_record.id
  FROM bids b
  WHERE b.auction_id = NEW.auction_id
    AND b.bidder_id != NEW.bidder_id
    AND b.amount = (
      SELECT MAX(amount) FROM bids
      WHERE auction_id = NEW.auction_id AND id != NEW.id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_bid_created
  AFTER INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION handle_new_bid();

-- End auction and select winner
CREATE OR REPLACE FUNCTION end_auction(p_auction_id UUID)
RETURNS VOID AS $$
DECLARE
  auction_record RECORD;
  winning_bid RECORD;
BEGIN
  SELECT * INTO auction_record FROM auctions WHERE id = p_auction_id FOR UPDATE;

  IF auction_record.status NOT IN ('active', 'scheduled') THEN
    RETURN;
  END IF;

  SELECT * INTO winning_bid FROM bids
  WHERE auction_id = p_auction_id
  ORDER BY amount DESC, created_at ASC
  LIMIT 1;

  IF winning_bid IS NOT NULL AND
     (auction_record.reserve_price IS NULL OR winning_bid.amount >= auction_record.reserve_price) THEN
    UPDATE auctions SET
      status = 'ended',
      winner_id = winning_bid.bidder_id,
      current_price = winning_bid.amount
    WHERE id = p_auction_id;

    INSERT INTO payments (auction_id, user_id, amount, shipping_fee, total_amount, fulfillment_type)
    VALUES (
      p_auction_id,
      winning_bid.bidder_id,
      winning_bid.amount,
      auction_record.shipping_fee,
      winning_bid.amount + auction_record.shipping_fee,
      auction_record.fulfillment_type
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

-- Activate scheduled auctions
CREATE OR REPLACE FUNCTION activate_scheduled_auctions()
RETURNS VOID AS $$
BEGIN
  UPDATE auctions
  SET status = 'active', current_price = starting_price
  WHERE status = 'scheduled'
    AND start_time <= NOW()
    AND (end_time IS NULL OR end_time > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End expired auctions
CREATE OR REPLACE FUNCTION end_expired_auctions()
RETURNS VOID AS $$
DECLARE
  auction_id UUID;
BEGIN
  FOR auction_id IN
    SELECT id FROM auctions
    WHERE status = 'active' AND end_time IS NOT NULL AND end_time <= NOW()
  LOOP
    PERFORM end_auction(auction_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspension_history ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is suspended
CREATE OR REPLACE FUNCTION is_suspended()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (
        is_suspended = TRUE
        OR (suspended_until IS NOT NULL AND suspended_until > NOW())
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Shipping addresses policies
CREATE POLICY "Users manage own addresses"
  ON shipping_addresses FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Auctions policies
CREATE POLICY "Anyone can view non-draft auctions"
  ON auctions FOR SELECT TO authenticated
  USING (status != 'draft' OR created_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage auctions"
  ON auctions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Bids policies
CREATE POLICY "Authenticated users can view bids"
  ON bids FOR SELECT TO authenticated USING (true);

CREATE POLICY "Non-suspended users can place bids"
  ON bids FOR INSERT TO authenticated
  WITH CHECK (
    bidder_id = auth.uid()
    AND NOT is_suspended()
    AND EXISTS (
      SELECT 1 FROM auctions
      WHERE id = auction_id AND status = 'active'
    )
  );

-- Watchlist policies
CREATE POLICY "Users manage own watchlist"
  ON watchlist FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Payments policies
CREATE POLICY "Users view own payments, admins view all"
  ON payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Winners can update own payments"
  ON payments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update payments"
  ON payments FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "System creates payments"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Notifications policies
CREATE POLICY "Users manage own notifications"
  ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Blacklist policies (admin only)
CREATE POLICY "Admins manage blacklist"
  ON blacklist FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Admin logs policies
CREATE POLICY "Admins view logs"
  ON admin_activity_logs FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Admins create logs"
  ON admin_activity_logs FOR INSERT TO authenticated
  WITH CHECK (is_admin() AND admin_id = auth.uid());

-- Suspension history policies
CREATE POLICY "Admins manage suspension history"
  ON suspension_history FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users view own suspension history"
  ON suspension_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime for bids and auctions
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
ALTER PUBLICATION supabase_realtime ADD TABLE auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Grant RPC access for cron jobs
GRANT EXECUTE ON FUNCTION activate_scheduled_auctions() TO service_role;
GRANT EXECUTE ON FUNCTION end_expired_auctions() TO service_role;
GRANT EXECUTE ON FUNCTION end_auction(UUID) TO service_role;
