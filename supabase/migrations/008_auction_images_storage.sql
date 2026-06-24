-- Migration 008: create the "auction-images" storage bucket used by the
-- admin auction form for cover photo + gallery photo uploads, with public
-- read access and admin-only write access.
-- Run in Supabase SQL Editor.

-- Guard against schema drift: ensure the columns the form writes to exist.
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_photos TEXT[];

INSERT INTO storage.buckets (id, name, public)
VALUES ('auction-images', 'auction-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view auction images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload auction images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update auction images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete auction images" ON storage.objects;

CREATE POLICY "Public can view auction images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'auction-images');

CREATE POLICY "Admins can upload auction images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'auction-images' AND is_admin());

CREATE POLICY "Admins can update auction images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'auction-images' AND is_admin())
  WITH CHECK (bucket_id = 'auction-images' AND is_admin());

CREATE POLICY "Admins can delete auction images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'auction-images' AND is_admin());
