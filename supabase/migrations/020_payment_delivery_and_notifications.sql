-- Migration 020: self-collection/tracking fields on payments, two new
-- notification types, and RLS so admins can (a) insert cross-user
-- notifications and (b) read a customer's shipping address.
--
-- notification_type was originally a Postgres ENUM (migration 001), but
-- running this migration hit "type notification_type does not exist" --
-- the enum type itself has been dropped from the live database (same
-- Dashboard-drift pattern documented in 017/018/019, and consistent with
-- the app already successfully inserting free-form notification_type
-- strings like 'bid_outbid'/'payment_verified' today, which a live enum
-- would reject unless those exact values were already members). The
-- column is therefore plain TEXT now, so no ALTER TYPE is needed at all
-- -- 'payment_submitted' and 'order_dispatched' just work as text values.
--
-- The "Admins can insert notifications" policy is absent from the live
-- database (same pattern as 017/018/019). Without it, an admin's INSERT
-- into notifications for a different user_id is silently filtered by
-- RLS's WITH CHECK, so notifying a winner of a verify/reject decision
-- silently no-ops. The app now performs these cross-user inserts via a
-- service-role route (/api/payments/notify) specifically because this
-- policy keeps getting lost to Dashboard drift, but it's restored here
-- too for defense-in-depth / any direct client usage.
--
-- shipping_addresses has never had an admin-read policy -- only
-- "Users manage own addresses" (USING (user_id = auth.uid())). Admins
-- reviewing a submitted payment need to see the winner's shipping
-- address, so this adds an additive SELECT policy for admins.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS collection_date DATE,
  ADD COLUMN IF NOT EXISTS collection_time_slot TEXT,
  ADD COLUMN IF NOT EXISTS collection_remarks TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT;

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all shipping addresses" ON public.shipping_addresses;
CREATE POLICY "Admins can view all shipping addresses"
  ON public.shipping_addresses FOR SELECT TO authenticated
  USING (public.is_admin());
