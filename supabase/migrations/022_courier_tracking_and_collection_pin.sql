-- Migration 022: courier selection + tracking links, self-collection PIN
-- verification, and a new "collected" payment status.
--
-- Adds courier (SPX Express / NinjaVan / LineClear) and collection_pin
-- columns to payments, alongside the payment_status = 'collected' value
-- used once an admin confirms a customer physically picked up their item.
--
-- payment_status was originally a Postgres ENUM (migration 001), but per
-- the schema-drift pattern documented in 017-020, it may already have
-- been converted to plain TEXT on the live database. The block below
-- only runs ALTER TYPE ... ADD VALUE when payment_status still exists as
-- an enum type, so this migration is safe either way.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS courier TEXT,
  ADD COLUMN IF NOT EXISTS collection_pin TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status' AND typtype = 'e') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumlabel = 'collected' AND enumtypid = 'payment_status'::regtype
    ) THEN
      ALTER TYPE payment_status ADD VALUE 'collected';
    END IF;
  END IF;
END $$;
