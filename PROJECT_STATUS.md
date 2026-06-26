# VS GAMEOLOGY Auction — Project Status

## Quick Reference

| Item | Value |
|------|-------|
| **GitHub Repo** | https://github.com/VSGAMEOLOGY/vs-gameology-auction |
| **Supabase Project ID** | `vhwgriyrfcjobtyjouhm` |
| **Supabase URL** | https://vhwgriyrfcjobtyjouhm.supabase.co |
| **Vercel Region** | Singapore (`sin1`) |
| **WhatsApp Number** | +60 13-968 1228 (`60139681228`) |
| **Bank** | Maybank |
| **Account No** | 5123 4373 9288 |
| **Account Name** | VS GAMEOLOGY |
| **Currency** | Malaysian Ringgit (MYR / RM) |

> Keys are in `.env.local` (not committed). See `.env.example` for the shape.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3 (App Router, Turbopack in dev) |
| Language | TypeScript 5.8 |
| UI | React 19, Tailwind CSS 4, lucide-react |
| Backend / DB | Supabase (Postgres 15, Auth, Storage, Realtime, pg_cron) |
| Validation | Zod |
| Dates | date-fns 4 |
| Hosting | Vercel |

---

## Database Schema (18 migrations applied)

### Tables
- **profiles** — live columns: `id`, `username` (unique), `real_name`, `whatsapp`, `role` (user/admin), `status` (active/suspended), `verification_status`, `completed_wins`, `unpaid_wins`, `total_bids`, `admin_notes`, `created_at`, `updated_at`. Note: `email`, `full_name`, `phone`, `is_suspended` were dropped during Dashboard schema evolution.
- **shipping_addresses** — saved delivery addresses per user
- **blacklist** — blocked emails (checked on signup)
- **auctions** — `title`, `description`, `cover_photo_url`, `gallery_photos[]`, `starting_price`, `current_bid`, `minimum_increment`, `reserve_price`, `status` (draft/scheduled/active/ended/cancelled), `start_at`/`end_at`, `shipping_type` (shipping/collection/both), `shipping_fee_west`, `shipping_fee_east`, `ships_to_west`, `ships_to_east`, `category_id`, `condition`, `region`, `languages[]`, `winner_user_id`, `auction_number`
- **bids** — `auction_id`, `bidder_id`, `bid_amount` (whole numbers), `is_winning`
- **watchlist** — user watchlist entries
- **payments** — `auction_id`, `winner_user_id`, `winning_bid`, `shipping_fee`, `total_amount`, `payment_status` (pending/submitted/verified/rejected/refunded), `receipt_url`, `fulfillment_type`, `shipping_address_id`, `payment_due_at`, `admin_notes`, `verified_by`, `verified_at`
- **notifications** — `user_id`, `notification_type`, `title`, `message`, `related_auction_id`, `is_read`
- **admin_activity_logs** — audit trail; columns: `admin_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`
- **suspension_history** — legacy; superseded by `user_suspensions`
- **user_suspensions** — active suspension records; `suspension_type` (temporary/permanent), `suspended_until`, `is_active`
- **categories** — `name`, `is_active`
- **business_settings** — key/value store for site-wide config (e.g. `payment_due_hours`)

### Storage Buckets
- `auction-images` — auction listing photos (uploaded by admin)
- `payment-receipts` — payment proof screenshots (uploaded by winners)

### DB Functions / Automation
- `handle_new_user()` — trigger on `auth.users` INSERT: creates profiles row; inserts `(id, username, real_name='', whatsapp='', role='user', status='active', verification_status='unverified', counters=0)`
- `handle_new_bid()` — trigger: validates bid, updates `current_bid`, sends outbid notification
- `end_auction(id)` — marks auction ended, sets winner, creates payment row, sends win notification
- `activate_scheduled_auctions()` / `end_expired_auctions()` — called by **pg_cron every minute**
- `lift_expired_suspension()` — SECURITY DEFINER; lets a user self-lift their own expired temp suspension
- `is_username_taken(text)` — anon-callable for real-time uniqueness check on the register form
- `is_admin()` / `is_suspended()` — RLS helpers

### Migration History
| # | File | Purpose |
|---|------|---------|
| 001 | `001_initial_schema.sql` | Core tables, RLS, triggers |
| 002 | `002_categories.sql` | Categories table |
| 003 | `003_whole_number_bids.sql` | Round bids to whole numbers |
| 004 | `004_schema_updates.sql` | West/east shipping fees, business_settings |
| 005 | `005_fix_auction_lifecycle_functions.sql` | Fix activate/end auction functions |
| 006 | `006_fix_payments_notifications.sql` | Fix payments/notifications schema drift |
| 007 | `007_fix_payment_creation_and_rls.sql` | Fix end_auction payment creation; RLS on user_suspensions, business_settings |
| 008 | `008_auction_images_storage.sql` | auction-images storage bucket |
| 009 | `009_drop_auction_winners.sql` | Drop unused auction_winners table |
| 010 | `010_shipping_zone_flags.sql` | ships_to_west / ships_to_east flags |
| 011 | `011_auto_lift_expired_suspension.sql` | lift_expired_suspension() function |
| 012 | `012_payment_receipts_storage.sql` | payment-receipts storage bucket |
| 013 | `013_enable_profiles_realtime.sql` | Enable realtime on profiles table |
| 014 | `014_username_signup.sql` | Username-based signup, is_username_taken() |
| 015 | `015_fix_handle_new_user_trigger.sql` | Fix trigger: remove dropped `email` column from INSERT |
| 016 | `016_fix_profiles_not_null_defaults.sql` | Fix trigger: supply all NOT NULL columns (real_name, whatsapp, status, verification_status) |
| 017 | `017_profiles_public_read_rls.sql` | RLS: allow authenticated users to read all profiles rows (fixes bid history showing Anonymous) |
| 018 | `018_admin_payments_update_rls.sql` | RLS: reinstate admin UPDATE policy on payments (fixes verify/reject in admin panel) |

---

## What's Been Built

### Public / Buyer
- [x] Homepage with dynamic CTAs
- [x] Auction list with live status badges, countdown timers, realtime updates
- [x] Auction detail page: gallery + lightbox, bid history (shows usernames publicly), live countdown, realtime price/status
- [x] Bidding (whole numbers only, min-increment enforced in DB trigger)
- [x] Watchlist
- [x] Notifications page (outbid notifications auto mark as read on View click; won-bid notifications stay unread as payment reminder)
- [x] Payment flow: per-zone shipping fee (West/East Malaysia), self-collection option, inline bank details, WhatsApp payment button with pre-filled auction details + payment page URL, receipt upload with filename confirmation
- [x] East Malaysia no-shipping: WhatsApp button with full auction + winner details pre-filled
- [x] Profile page: username (read-only), full name, phone/WhatsApp, shipping address manager (add/edit/delete/default)
- [x] Password show/hide toggle on login and register forms
- [x] Suspension wall (`/suspended`): shows reason, expiry, WhatsApp appeal link; auto-lifts expired temp suspensions; realtime redirect if suspended mid-session

### Auth
- [x] Register (username-based, blacklist check, duplicate username check, profiles row auto-created by trigger)
- [x] Login
- [x] Forgot password (email link)
- [x] Reset password
- [x] Middleware-based route protection
- [x] Logout visible for all authenticated users (not just admins)

### Admin (`/admin/*`)
- [x] Dashboard: total users, active auctions, pending payments, total revenue, activity log
- [x] Auction management: create, edit, clone, schedule, bulk create
- [x] Auction form: title, description, photos, category, condition, region, language, shipping type, per-zone fees, per-zone availability, starting price, increment, reserve, start/end times
- [x] Schedule preview page
- [x] User management: list users, suspend (temp/permanent with reason), unsuspend
- [x] Payment management: view submitted payments, verify/reject (tab switches to Verified/Rejected after action), add admin notes
- [x] Suspensions management page
- [x] Activity logs page

---

## What's Still Pending / Known Gaps

### Features Not Yet Built
- [ ] Admin — edit/delete categories (UI exists in form dropdown but no category CRUD page)
- [ ] Admin — business_settings UI (table exists, `payment_due_hours` used by `end_auction()`, but no admin page to manage it yet)
- [ ] Admin — blacklist management UI (table exists with RLS, no front-end page)
- [ ] Winner email notifications (Supabase email not wired beyond auth emails)
- [ ] Public Terms / Privacy pages are stubs
- [ ] Search / filter / sort on auction list (currently shows all non-draft auctions)
- [ ] Mobile-optimised layout pass (Tailwind classes exist but no dedicated QA pass)

### Known Issues / Watch Points
- The `admin_activity_logs` query on the dashboard selects `full_name` from profiles, but the live schema uses `username`; the dashboard activity log may show blank names for users registered after the schema change.
- The `/api/cron/auctions` Next.js route still exists and is valid (protected by `CRON_SECRET`) but the **primary** scheduler is **Supabase pg_cron** — verify in the Supabase dashboard that the cron job is active and running every minute.
- Email confirmation is required at signup (`enable_confirmations = true` in `supabase/config.toml`). Ensure the Supabase Auth email templates and SMTP are configured in the Supabase dashboard for the production project.
- `supabase/config.toml` sets `site_url = http://localhost:3000` — update the **production** project's Auth settings in the Supabase dashboard to point to the live Vercel URL.
- `shipping_addresses.id` type mismatch: initial schema used `uuid_generate_v4()` but migration 006 adds a BIGINT FK reference — verify the column is consistent in production.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY       # Supabase service role key (server-only)
NEXT_PUBLIC_APP_URL             # Full URL of the deployed app (optional — falls back to window.location.origin at runtime)
NEXT_PUBLIC_APP_NAME            # Display name (VS GAMEOLOGY Auction)
CRON_SECRET                     # Secret for /api/cron/auctions endpoint
```

All values are in `.env.local`. For Vercel deployment, set these in the Vercel project's Environment Variables dashboard.

---

## Deployment Checklist

- [ ] Set all env vars in Vercel dashboard
- [ ] Update Supabase Auth `site_url` and redirect URLs to production domain
- [ ] Confirm pg_cron job is enabled and running in Supabase dashboard
- [ ] Configure Supabase Auth SMTP / email templates for production
- [ ] Apply all migrations (001–018) via Supabase SQL Editor
- [ ] Create storage buckets `auction-images` and `payment-receipts` (public read)
- [ ] Seed at least one admin user (set `role = 'admin'` in profiles table)
