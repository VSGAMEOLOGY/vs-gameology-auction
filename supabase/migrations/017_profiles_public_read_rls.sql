-- Migration 017: ensure authenticated users can read all profiles rows.
--
-- The original policy from migration 001 ("Public profiles are viewable by
-- authenticated users", USING (true)) may have been replaced during direct
-- Dashboard schema edits with a more restrictive own-row-only policy. That
-- breaks the bid-history JOIN (bidder:profiles) for bids placed by other
-- users — their profile row is filtered out by RLS, returning null and
-- causing the UI to display "Anonymous" for every other bidder.
--
-- Run in Supabase SQL Editor.

-- Drop any existing SELECT policies on profiles so we can replace them cleanly.
-- The INSERT/UPDATE/DELETE policies are left untouched.
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Allow any authenticated user to read any profile row.
-- Username is public; sensitive fields (whatsapp, real_name) are protected at
-- the application layer by only selecting the columns we actually need.
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);
