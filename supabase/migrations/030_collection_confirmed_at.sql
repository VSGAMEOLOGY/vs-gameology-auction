-- Migration 030: track when an item was actually collected.
--
-- The customer-facing payment page needs to know not just that
-- payment_status = 'collected', but when, so it can stop showing the
-- collection PIN and show a "Collected on [date]" confirmation instead.
-- Mirrors the dispatched_at column added in migration 023.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
