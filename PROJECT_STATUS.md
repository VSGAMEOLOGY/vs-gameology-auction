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

## Database Schema (14 migrations applied)

### Tables
- **profiles** — extends `auth.users`; columns: `id`, `email`, `username` (unique), `full_name`, `phone`, `avatar_url`, `role` (user/admin), `status`, `created_at`
- **shipping_addresses** — saved delivery addresses per user
- **blacklist** — blocked emails (checked on signup)
- **auctions** — `title`, `description`, `image_url`, `photo_urls[]`, `starting_price`, `current_bid`, `minimum_increment`, `reserve_price`, `status` (draft/scheduled/active/ended/cancelled), `start_time`/`end_at`, `shipping_type` (shipping/collection/both), `shipping_fee_west`, `shipping_fee_east`, `ships_to_west`, `ships_to_east`, `category_id`, `condition`, `region`, `languages[]`, `winner_user_id`, `auction_number`
- **bids** — `auction_id`, `bidder_id`, `bid_amount` (whole numbers), `is_winning`
- **watchlist** — user watchlist entries
- **payments** — `auction_id`, `winner_user_id`, `winning_bid`, `shipping_fee`, `total_amount`, `payment_status` (pending/submitted/verified/rejected/refunded), `receipt_url`, `fulfillment_type`, `shipping_address_id`, `payment_due_at`, `admin_notes`
- **notifications** — `user_id`, `notification_type`, `title`, `message`, `related_auction_id`, `is_read`
- **admin_activity_logs** — audit trail of all admin actions
- **suspension_history** — legacy; superseded by `user_suspensions`
- **user_suspensions** — active suspension records; `suspension_type` (temporary/permanent), `suspended_until`, `is_active`
- **categories** — `name`, `is_active`
- **business_settings** — key/value store for site-wide config (e.g. `payment_due_hours`)

### Storage Buckets
- `auction-images` — auction listing photos (uploaded by admin)
- `payment-receipts` — payment proof screenshots (uploaded by winners)

### DB Functions / Automation
- `handle_new_bid()` — trigger: validates bid, updates `current_bid`, sends outbid notification
- `end_auction(id)` — marks auction ended, sets winner, creates payment row, sends win notification
- `activate_scheduled_auctions()` / `end_expired_auctions()` — called by **pg_cron every minute**
- `lift_expired_suspension()` — SECURITY DEFINER; lets a user self-lift their own expired temp suspension
- `is_username_taken(text)` — anon-callable for real-time uniqueness check on the register form
- `is_admin()` / `is_suspended()` — RLS helpers

---

## What's Been Built

### Public / Buyer
- [x] Homepage with dynamic CTAs
- [x] Auction list with live status badges, countdown timers, realtime updates
- [x] Auction detail page: gallery + lightbox, bid history, live countdown, realtime price/status
- [x] Bidding (whole numbers only, min-increment enforced in DB trigger)
- [x] Watchlist
- [x] Notifications page
- [x] Payment flow: per-zone shipping fee (West/East Malaysia), self-collection option, inline bank details, WhatsApp payment button, receipt upload to Supabase Storage
- [x] Profile page: username/full name/phone, shipping address manager (add/edit/delete/default)
- [x] Suspension wall (`/suspended`): shows reason, expiry, WhatsApp appeal link; auto-lifts expired temp suspensions; realtime redirect if suspended mid-session

### Auth
- [x] Register (username-based, blacklist check, duplicate username check)
- [x] Login
- [x] Forgot password (email link)
- [x] Reset password
- [x] Middleware-based route protection

### Admin (`/admin/*`)
- [x] Dashboard: total users, active auctions, pending payments, total revenue, activity log
- [x] Auction management: create, edit, clone, schedule, bulk create
- [x] Auction form: title, description, photos, category, condition, region, language, shipping type, per-zone fees, per-zone availability, starting price, increment, reserve, start/end times
- [x] Schedule preview page
- [x] User management: list users, suspend (temp/permanent with reason), unsuspend
- [x] Payment management: view submitted payments, verify/reject, add admin notes
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
- The `admin_activity_logs` query on the dashboard selects `full_name` from profiles, but migration 014 made `username` the primary display field; the dashboard may show blank names for users registered after that migration.
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
NEXT_PUBLIC_APP_URL             # Full URL of the deployed app
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
- [ ] Apply any pending migrations via Supabase SQL Editor (migrations 001–014)
- [ ] Create storage buckets `auction-images` and `payment-receipts` (public read)
- [ ] Seed at least one admin user (set `role = 'admin'` in profiles table)
