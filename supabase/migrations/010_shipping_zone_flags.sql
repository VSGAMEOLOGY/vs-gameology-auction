-- Migration 010: add per-zone shipping availability flags to auctions.
-- Lets an admin disable shipping to West or East Malaysia independently
-- (e.g. an item that can only ship within West Malaysia), while keeping
-- the existing shipping_fee_west/shipping_fee_east price fields.
-- Run in Supabase SQL Editor.

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS ships_to_west BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ships_to_east BOOLEAN NOT NULL DEFAULT true;
