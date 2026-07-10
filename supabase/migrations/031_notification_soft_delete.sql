-- Migration 031: soft delete for notifications.
--
-- Buyers need a way to dismiss individual notifications from their own
-- view without the underlying row being erased (kept for debugging /
-- audit purposes). Same approach as shipping_addresses.is_active in
-- migration 027, using a nullable timestamp instead of a boolean so we
-- also retain when it was dismissed.
--
-- No FK anywhere references notifications.id, so this column has no
-- effect on any other table (payments, bids, orders, admin views all
-- remain untouched).
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- No RLS policy changes needed: "Users can update own notifications" already
-- covers UPDATE of dismissed_at on the user's own rows (see migration 004).
