-- Migration 009: drop the unused auction_winners table.
-- It was never written to or read from by any application code or
-- migration logic -- the winner is tracked via auctions.winner_user_id
-- instead. Migration 007 only enabled RLS on it defensively because the
-- Supabase advisor flagged it as an unprotected table.
-- Run in Supabase SQL Editor.

DROP TABLE IF EXISTS auction_winners;
