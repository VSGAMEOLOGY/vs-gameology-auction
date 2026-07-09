-- Migration 028: track how many times a winner has resubmitted payment
-- proof after a rejection.
--
-- Incremented client-side (see /payments/[auctionId]) whenever a payment
-- is resubmitted while payment_status is "rejected". Never touched on a
-- first-time submission. Surfaced on /admin/payments as a "Resubmission
-- #N" badge so admins can spot repeat resubmitters at a glance.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0;
