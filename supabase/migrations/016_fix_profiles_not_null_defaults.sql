-- Migration 016: fix handle_new_user trigger and backfill to supply values for
-- all NOT NULL columns that were added to profiles via the Supabase Dashboard
-- without defaults (real_name, whatsapp, status, verification_status).
--
-- Migration 015 only inserted (id, username), which failed because these columns
-- have no DB-level DEFAULT and aren't nullable.
--
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.blacklist WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'This email is blacklisted and cannot register';
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      real_name,
      whatsapp,
      role,
      status,
      verification_status,
      completed_wins,
      unpaid_wins,
      total_bids
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      '',           -- real_name: user sets this on the profile page
      '',           -- whatsapp: user sets this on the profile page
      'user',
      'active',
      'unverified',
      0,
      0,
      0
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This username is already taken. Please choose another.';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profiles rows for any auth users still missing one
INSERT INTO public.profiles (
  id,
  username,
  real_name,
  whatsapp,
  role,
  status,
  verification_status,
  completed_wins,
  unpaid_wins,
  total_bids
)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  '',
  '',
  'user',
  'active',
  'unverified',
  0,
  0,
  0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
