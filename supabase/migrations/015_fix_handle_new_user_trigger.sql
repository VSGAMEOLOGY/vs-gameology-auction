-- Migration 015: fix handle_new_user trigger after email column was dropped from profiles.
--
-- Root cause: migration 014's handle_new_user() inserted into (id, email, username),
-- but the `email` column was dropped from profiles during direct schema edits in the
-- Supabase Dashboard. The undefined_column error was swallowed by Supabase GoTrue,
-- leaving auth users with no matching profiles row (e.g. vivian.soo@gmail.com).
--
-- Fix: insert only (id, username); all other columns rely on DB defaults.
-- Also drops and recreates the trigger in case it was detached during schema changes.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.blacklist WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'This email is blacklisted and cannot register';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This username is already taken. Please choose another.';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (idempotent — safe if it already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profiles rows for any auth users who slipped through without one.
-- Uses ON CONFLICT so it is safe to run multiple times.
INSERT INTO public.profiles (id, username)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
