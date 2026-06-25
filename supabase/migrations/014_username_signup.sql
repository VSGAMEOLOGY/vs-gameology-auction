-- Migration 014: registration now collects a username instead of a full
-- name, and needs a pre-submit uniqueness check the anon role can call.
-- Run in Supabase SQL Editor.

-- Enforce uniqueness at the DB level (final backstop behind the client-side
-- check). Requires no existing duplicate usernames in profiles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- Auto-create profile on signup, using the username from signup metadata
-- instead of full_name/real_name.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM blacklist WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'This email is blacklisted and cannot register';
  END IF;

  BEGIN
    INSERT INTO profiles (id, email, username)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'username', '')
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This username is already taken. Please choose another.';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lets the registration form check username availability before signUp,
-- without exposing the rest of the profiles table to anon.
CREATE OR REPLACE FUNCTION is_username_taken(p_username TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE username = p_username);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_username_taken(TEXT) TO anon, authenticated;
