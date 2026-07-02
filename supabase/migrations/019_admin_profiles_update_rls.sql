-- Migration 019: ensure admins can update any profile (role/status changes).
--
-- The "Admins can update any profile" policy from migration 001 is absent
-- from the live database, likely dropped during direct Dashboard schema
-- edits (same pattern as 017/018). Without it, an admin's UPDATE on another
-- user's profiles row (e.g. suspending a user, promoting to admin) is
-- silently filtered to zero rows by RLS -- no JS error is thrown, so the
-- UI proceeds as if it succeeded while profiles.status/role never changes.
--
-- Run in Supabase SQL Editor.

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
