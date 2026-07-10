-- Migration 032: admin search across payments, joined auction/buyer fields,
-- and buyer email.
--
-- Buyer email lives only in auth.users (profiles.email was dropped in
-- migration 015), and PostgREST/supabase-js cannot express a single OR
-- query spanning payments + auctions + profiles + auth.users in one call.
-- This SECURITY DEFINER function does the join + OR search server-side,
-- gated by is_admin(), mirroring the existing is_admin()/handle_new_user()
-- pattern already used in this schema. It returns matching payment ids only;
-- the client re-fetches those ids with the normal embed-select so existing
-- card rendering is unchanged.
--
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.admin_search_payments(p_query TEXT, p_status TEXT DEFAULT 'all')
RETURNS TABLE(id payments.id%TYPE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id
  FROM payments p
  LEFT JOIN auctions a ON a.id = p.auction_id
  LEFT JOIN profiles pr ON pr.id = p.winner_user_id
  LEFT JOIN auth.users au ON au.id = p.winner_user_id
  WHERE (p_status = 'all' OR p.payment_status::TEXT = p_status)
    AND (
      a.auction_number ILIKE '%' || p_query || '%' OR
      a.title ILIKE '%' || p_query || '%' OR
      pr.real_name ILIKE '%' || p_query || '%' OR
      pr.username ILIKE '%' || p_query || '%' OR
      pr.whatsapp ILIKE '%' || p_query || '%' OR
      au.email ILIKE '%' || p_query || '%' OR
      p.tracking_number ILIKE '%' || p_query || '%' OR
      p.collection_remarks ILIKE '%' || p_query || '%' OR
      p.admin_notes ILIKE '%' || p_query || '%'
    )
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_payments(TEXT, TEXT) TO authenticated;
