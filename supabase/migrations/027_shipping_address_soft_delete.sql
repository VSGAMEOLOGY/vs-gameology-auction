-- Migration 027: soft delete for shipping addresses.
--
-- Deleting a shipping_addresses row outright can violate the FK on
-- payments.shipping_address_id for any address that was used in a past
-- order, silently failing and leaving the "deleted" address reappearing
-- after refresh. Instead, "deleting" an address now just hides it via
-- is_active = false; past payment records keep referencing the row
-- untouched.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.shipping_addresses
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- No RLS policy changes needed: "Users manage own addresses" is already
-- FOR ALL (USING/WITH CHECK user_id = auth.uid()), which covers UPDATE
-- of is_active on the user's own rows.
