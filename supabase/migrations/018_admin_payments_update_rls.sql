-- Migration 018: ensure admins can update payment status (verify / reject).
--
-- The "Admins can update payments" policy from migration 001 may be absent
-- from the live database if it was dropped during direct Dashboard schema
-- edits. Without it the admin's payments UPDATE is silently blocked by RLS
-- and verifyPayment() appears to succeed (no JS error thrown) but the row
-- is never changed.
--
-- Run in Supabase SQL Editor.

DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
