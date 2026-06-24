-- Migration 012: create the "payment-receipts" storage bucket so winners
-- can upload a payment screenshot directly from the payment page instead
-- of pasting an external link.
-- Run in Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage payment receipts" ON storage.objects;

CREATE POLICY "Public can view payment receipts"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'payment-receipts');

CREATE POLICY "Users can upload own payment receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can manage payment receipts"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'payment-receipts' AND is_admin())
  WITH CHECK (bucket_id = 'payment-receipts' AND is_admin());
