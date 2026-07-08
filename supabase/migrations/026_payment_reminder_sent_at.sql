-- Migration 026: track when a payment reminder email was last sent.
--
-- Admins can manually resend the win-notification email from
-- /admin/payments (reusing the existing "won" event), and now also send a
-- one-off "Payment Reminder" email to winners who have had a pending
-- payment for more than 24 hours. This column records the last time that
-- reminder was sent so the admin UI can show "Reminder Sent [time]"
-- after clicking, instead of a plain button with no feedback.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ;
