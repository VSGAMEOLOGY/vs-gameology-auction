-- Migration 023: "dispatched" / "delivered" payment statuses, a
-- dispatched_at timestamp, and a daily pg_cron job that auto-marks
-- shipped orders as delivered 14 days after tracking was saved.
--
-- payment_status was originally a Postgres ENUM (migration 001), but per
-- the schema-drift pattern documented in 017-022, it may already have
-- been converted to plain TEXT on the live database. The block below
-- only runs ALTER TYPE ... ADD VALUE when payment_status still exists as
-- an enum type, so this migration is safe either way (mirrors 022).
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status' AND typtype = 'e') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumlabel = 'dispatched' AND enumtypid = 'payment_status'::regtype
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'dispatched';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumlabel = 'delivered' AND enumtypid = 'payment_status'::regtype
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'delivered';
    END IF;
  END IF;
END $$;

-- Auto-mark shipped orders as delivered 14 days after dispatch.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-mark-delivered') THEN
    PERFORM cron.unschedule('auto-mark-delivered');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-mark-delivered',
  '0 0 * * *',
  $$
    UPDATE public.payments
    SET payment_status = 'delivered'
    WHERE payment_status = 'dispatched'
      AND dispatched_at IS NOT NULL
      AND dispatched_at <= NOW() - INTERVAL '14 days';
  $$
);
