-- Migration 024: support emailing customers on delivery (manual and
-- auto) and on winning an auction.
--
-- pg_cron can only execute SQL -- it cannot send SMTP mail. The
-- "auto-mark-delivered" job added in 023 therefore flipped shipments to
-- 'delivered' with no customer-facing notice at all. Auto-delivery now
-- runs from an application-level Vercel Cron endpoint
-- (/api/cron/deliveries) instead, which can update the row AND send the
-- delivered email/notification together. Unschedule the old SQL-only
-- job here (guarded: no-op if pg_cron was never actually enabled).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-mark-delivered') THEN
      PERFORM cron.unschedule('auto-mark-delivered');
    END IF;
  END IF;
END $$;

-- Tracks whether the "you won!" email has been sent for a payment, so
-- /api/cron/auctions can poll for newly-created winning payments and
-- email them exactly once. end_auction() (005/006) already inserts a
-- website notification on win but never an email.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS win_email_sent_at TIMESTAMPTZ;

-- Backfill existing rows so this rollout doesn't blast a "you won!"
-- email to every customer who already won (and was already notified via
-- the website notification) before this column existed.
UPDATE public.payments
SET win_email_sent_at = created_at
WHERE win_email_sent_at IS NULL;
