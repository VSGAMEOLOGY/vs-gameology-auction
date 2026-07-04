-- Migration 025: switch win-email tracking to a plain boolean flag.
--
-- Migration 024 added payments.win_email_sent_at, polled by
-- /api/cron/auctions -- but nothing in this repo actually schedules that
-- endpoint (no crons entry in vercel.json, no GitHub Action), so the
-- winner email never fires in practice. The winner email is now instead
-- triggered client-side, the first time the winner loads their own
-- pending payment page (see /payments/[auctionId]/page.tsx), via
-- /api/payments/notify's new "won" event. That event does an atomic
-- claim-and-flip on this new boolean column to guarantee the email is
-- sent at most once even if the page effect fires more than once.
--
-- win_email_sent_at (024) is left in place, unused going forward, rather
-- than dropped -- it's harmless and dropping columns on a live table
-- isn't worth the risk for this.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS win_email_sent BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark every pre-existing row as already handled so this
-- rollout doesn't retroactively email every past winner the moment they
-- next open their payment page. Only payments created after this
-- migration runs should default to false and trigger the win email.
UPDATE public.payments
SET win_email_sent = true
WHERE win_email_sent = false;
