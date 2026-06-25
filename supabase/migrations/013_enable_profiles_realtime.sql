-- Migration 013: enable realtime on profiles so the suspended-user listener
-- and the admin user list can both subscribe to profiles.status changes.
-- Run in Supabase SQL Editor.

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
