-- Migration 004: schema updates to match current codebase
-- Run in Supabase SQL Editor

-- ============================================================
-- 1. auctions: add west/east shipping fees, drop removed cols
-- ============================================================

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS shipping_fee_west DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_fee_east DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Copy existing shipping_fee into both new columns before dropping
UPDATE auctions
SET
  shipping_fee_west = COALESCE(shipping_fee, 0),
  shipping_fee_east = COALESCE(shipping_fee, 0)
WHERE shipping_fee_west = 0 AND shipping_fee_east = 0
  AND COALESCE(shipping_fee, 0) > 0;

ALTER TABLE auctions
  DROP COLUMN IF EXISTS shipping_fee,
  DROP COLUMN IF EXISTS courier_name,
  DROP COLUMN IF EXISTS item_type,
  DROP COLUMN IF EXISTS condition_notes;

-- ============================================================
-- 2. watchlists: enable RLS and add user policy
-- ============================================================

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own watchlist" ON watchlists;
CREATE POLICY "Users manage own watchlist"
  ON watchlists FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. auctions: allow anonymous visitors to browse
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view non-draft auctions" ON auctions;
DROP POLICY IF EXISTS "Anon can view public auctions" ON auctions;
DROP POLICY IF EXISTS "Authenticated users can view non-draft auctions" ON auctions;

CREATE POLICY "Anon can view public auctions"
  ON auctions FOR SELECT TO anon
  USING (status IN ('active', 'scheduled'));

CREATE POLICY "Authenticated users can view non-draft auctions"
  ON auctions FOR SELECT TO authenticated
  USING (status != 'draft' OR created_by = auth.uid() OR is_admin());

-- ============================================================
-- 4. bids: allow anonymous visitors to view bid history
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view bids" ON bids;
DROP POLICY IF EXISTS "Anyone can view bids" ON bids;

CREATE POLICY "Anyone can view bids"
  ON bids FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- 5. notifications: fix admin insert bug
-- ============================================================
-- The original FOR ALL policy blocked admins from sending
-- notifications to other users (e.g. on account suspension).

DROP POLICY IF EXISTS "Users manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- ============================================================
-- 6. business_settings: new table for site-wide config
-- ============================================================

CREATE TABLE IF NOT EXISTS business_settings (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT        NOT NULL UNIQUE,
  value      JSONB       NOT NULL DEFAULT '""',
  description TEXT,
  updated_by UUID        REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read business settings" ON business_settings;
DROP POLICY IF EXISTS "Admins can manage business settings" ON business_settings;

CREATE POLICY "Anyone can read business settings"
  ON business_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage business settings"
  ON business_settings FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE TRIGGER business_settings_updated_at
  BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
