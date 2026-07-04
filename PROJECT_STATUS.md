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

## Session Log

### Day 8 — 4 July 2026 (later still, part 3)

**Fixed:**
- Notification "View" button for `order_delivered` and `collection_confirmed` was falling through to `/auctions/[id]` instead of `/payments/[auctionId]` (only `auction_won`/`payment_verified`/`payment_rejected`/`order_dispatched` were in the payments-page branch) — added the two missing types. Left `payment_submitted` routing to `/admin/payments` as-is: that notification goes to admins, and `/payments/[auctionId]` is hardcoded to the *viewer's own* `winner_user_id`, so sending an admin there would just hang on "Loading..." forever.
- Admin `/admin/payments` "Delivery Details" dropdown was hidden for the Pending tab (`payment.payment_status !== "pending"` gate) — now shows on every tab.
- Win email reliability: confirmed via `vercel crons ls` that `/api/cron/auctions` was never actually registered with Vercel (only `/api/cron/deliveries` was) — the client-side "trigger on first page load" from last session is a real mechanism but has no guarantee the winner ever visits that page. Rather than reach for a Postgres-side webhook (`pg_net` calling back into the app, which risks breaking the `payments` INSERT itself if the trigger misbehaves, and needs secret material that can't safely live in a committed migration), registered `/api/cron/auctions` in `vercel.json` at `*/5 * * * *` — it already contains fully-tested win-email logic (atomic claim on `payments.win_email_sent`, same as the client path) from two sessions ago, so this reuses working code instead of adding new untested DB-trigger machinery. The client-side trigger stays in place as a faster (near-instant) path for anyone who does check promptly; the cron is the guaranteed backstop within 5 minutes for everyone else.

**Note:** the win email flow needs migrations 024 and 025 actually applied in Supabase (columns `win_email_sent_at`, `win_email_sent`) — if those haven't been run yet, the atomic claim will silently fail and no win email will ever send, which would look identical to "still not sending."

---

### Day 7 — 4 July 2026 (later still, part 2)

**Fixed:**
- Winner email genuinely fires now: `/api/cron/auctions`'s win-email polling was dead code because nothing schedules that endpoint (no `crons` entry, no GitHub Action). The win email is now triggered client-side instead, the first time the winner loads their own pending payment page (`/payments/[auctionId]/page.tsx` calls `/api/payments/notify` with a new `"won"` event). That event does an atomic claim-and-flip on `payments.win_email_sent` (new boolean, migration 025) so it can never double-send even if the effect fires twice; the old cron path was kept as a harmless backup using the same flag.
- Receiver name/phone across all customer-facing emails (verified, dispatched, collection confirmed, delivered) and the `/payments/[auctionId]` "Receiver Information" card now come from the shipping address the customer actually selected (`shipping_addresses.recipient_name` / `.phone`) instead of `profiles.real_name` / `.whatsapp`, via a shared `resolveReceiverInfo()` helper — profile fields are now only a fallback for self-collection orders (no shipping address on file).

**Migrations applied:**
- 025: `payments.win_email_sent` boolean (backfilled so existing payments don't retroactively trigger a "you won" email)

---

### Day 6 — 4 July 2026 (later still)

**Added:**
- Delivered-order emails: admin's manual "Mark as Delivered" and the new `/api/cron/deliveries` auto-deliver endpoint both now send a "Your Order Has Been Delivered!" email + website notification (the raw `pg_cron` job from 023 could update the row but not send mail, so it's unscheduled in 024 in favor of this Vercel Cron endpoint)
- Auction-winner email: `/api/cron/auctions` now emails winners "Congratulations! You Won" (with shipping-option ranges, since delivery method isn't chosen yet) alongside the existing website notification; tracked via new `payments.win_email_sent_at` so it only fires once per payment
- Admin panel link button added to the "New Payment Submitted" admin email
- All order-summary emails (submitted/verified/dispatched/collected/delivered) now consistently show Auction Title, Auction Number, Winning Bid, a zone-aware Shipping Fee (West/East Malaysia or Self Collection, read from `payments.shipping_fee` — never hardcoded), and Total Amount
- Auction number added to the post-submission "Order Summary" card on `/payments/[auctionId]` (was already on the pre-submission collapsed summary)

**Fixed:**
- Admin "Confirm Collection" now removes the row from view and switches to the Collected tab immediately, instead of leaving it stuck under Verified until a manual refresh

**Migrations applied:**
- 024: `payments.win_email_sent_at` column (backfilled so existing payments don't retroactively get a "you won" email), unschedules the 023 `auto-mark-delivered` pg_cron job

**Note:** `/api/cron/auctions` itself doesn't appear to be wired up to any scheduler in this repo (`vercel.json` had no `crons` entry before this session, and there's no GitHub Action either) — only `/api/cron/deliveries` was added to `vercel.json` here. Worth checking whether auctions are actually auto-ending in production.

---

### Day 5 — 4 July 2026 (later)

**Added:**
- Full shipping lifecycle: saving a tracking number on a verified shipping payment now auto-transitions it to `dispatched` (stamping `dispatched_at`); admin can manually "Mark as Delivered", and revert a delivered order back to `dispatched` in case of dispute
- A daily `pg_cron` job auto-marks `dispatched` shipping payments as `delivered` 14 days after `dispatched_at`
- Admin payments page tabs reordered/expanded: All | Submitted | Pending | Verified | Dispatched | Delivered | Collected | Rejected
- Customer payment page shows tailored copy per status ("Payment Verified - Preparing Your Item", "Your Order Has Been Dispatched", "Your Order Has Been Delivered - Thank you!")
- Collection-confirmed email now includes the auction number

**Migrations applied:**
- 023: `dispatched_at` column, `'dispatched'`/`'delivered'` payment status values, `auto-mark-delivered` pg_cron job

---

### Day 4 — 4 July 2026

**Added:**
- Email header branding fixed: "VS GAMEOLOGY" now fully blue (`#3B5BDB`), hammer emoji swapped for an inline SVG gavel matching the navbar icon
- Courier selection (SPX Express / NinjaVan / LineClear) added alongside tracking number; customer payment page and dispatched email now show the courier and a clickable "Track Your Order" link built from the correct per-courier URL
- Auction number now shown on the customer `/payments` list and in the payment page's order summary
- Self-collection PIN verification: a random 6-digit PIN is generated when admin verifies a self-collection order, shown to the customer (payment page + verified email), and admin confirms collection by entering it — moves payment status to `collected` and sends a final "collection confirmed" email/notification

**Migrations applied:**
- 022: `courier` + `collection_pin` columns on `payments`, plus `'collected'` payment status value

---

### Day 3 — 3 July 2026 (tag: `v0.8-suspension-complete`)

**Fixed — suspension enforcement now fully working end-to-end:**
- Admin's UPDATE on another user's `profiles` row was silently filtered to zero rows by RLS (no JS error, so the UI proceeded as if suspend/unsuspend/role-change succeeded while `profiles.status`/`role` never actually changed) — restored the missing "Admins can update any profile" policy (migration 019)
- Suspended users are now blocked from every page: the root layout does a server-side content swap so there's no flash of real content before redirect
- `/suspended` view redesigned: topbar keeps only the logo (no nav links) and a Logout button; behind the notice card, a blurred/dimmed replica of the homepage hero + features section is shown instead of a plain grey background, so the site still looks "present" while access is blocked
- Only Contact Us (WhatsApp appeal) and Logout are reachable while suspended
- Auto-lift of expired temporary suspensions confirmed working (`lift_expired_suspension()`, migration 011)
- Suspension notice correctly shows the suspension reason and end time (`suspended_until`)

**Migrations applied:**
- 019: Restore admin profiles UPDATE RLS policy (fixes suspend/unsuspend and role changes silently no-op'ing)

---

### Day 2 — 26 June 2026 (tag: `v0.7-fixes-day2`)

**Fixed:**
- Profile page crash for normal users
- Logout button missing for normal users
- Password show/hide toggle on login and register forms
- Profile row not created on signup (migrations 015 and 016)
- Shipping address foreign key error
- East Malaysia payment WhatsApp button with full auction details and payment upload link
- Bid history showing Anonymous instead of username
- File attachment confirmation wording on payment page
- Payment verification not moving to Verified tab (migration 018)
- Payment upload link showing `undefined` in WhatsApp message
- Outbid notifications auto mark as read on click
- Suspension management page showing expired suspensions as still active
- Suspension count badge on admin user management page
- Search bar on admin user management page
- Payment verification dropdowns for auction and winner details
- Profiles public read RLS policy (migration 017)

**Migrations applied:**
- 015: Fix handle_new_user trigger (remove dropped email column)
- 016: Fix profiles NOT NULL column defaults (real_name, whatsapp, status, verification_status)
- 017: Profiles public read RLS policy (fixes bid history Anonymous bug)
- 018: Admin payments update RLS policy (fixes verify/reject in admin panel)

**Still pending from this session:**
- Suspension enforcement — user can still browse after being suspended (edge runtime blocks service-role approach; requires further investigation)

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

## Database Schema (19 migrations applied)

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
| 019 | `019_admin_profiles_update_rls.sql` | RLS: reinstate admin UPDATE policy on profiles (fixes suspend/unsuspend and role changes silently no-op'ing) |

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
- [x] Suspension wall (`/suspended`): shows reason, expiry, WhatsApp appeal link; auto-lifts expired temp suspensions; realtime redirect if suspended mid-session; blocks every page via server-side layout swap; blurred/dimmed homepage backdrop behind the notice card with a logo-only, nav-free topbar; only Contact Us and Logout reachable

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
- [x] User management: list users, suspend (temp/permanent with reason), unsuspend, search by name/username, suspension count badge (total times suspended) — status/role updates now persist correctly (migration 019) and enforcement blocks the user immediately
- [x] Payment management: view submitted payments, verify/reject (tab switches to Verified/Rejected after action), add admin notes, expandable auction detail dropdown, expandable winner detail dropdown
- [x] Suspensions management page: auto-lifts expired suspensions on page load, only shows truly active suspensions (permanent or future-dated)
- [x] Activity logs page

---

## What's Still Pending / Known Gaps

### Pre-Launch (Blocking)
- [ ] Connect Hostinger domain to Vercel
- [ ] Confirm pg_cron is active in Supabase dashboard
- [ ] Set `NEXT_PUBLIC_APP_URL` in Vercel environment variables
- [ ] Mobile layout QA pass
- [ ] Terms of Service and Privacy Policy pages (currently stubs)

### Nice to Have After Launch
- [ ] Winner email notifications (Supabase email not wired beyond auth emails)
- [ ] Search / filter / sort on auction list page
- [ ] Admin — category CRUD page
- [ ] Admin — blacklist management UI
- [ ] Admin — business_settings UI

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
- [ ] Apply all migrations (001–019) via Supabase SQL Editor
- [ ] Create storage buckets `auction-images` and `payment-receipts` (public read)
- [ ] Seed at least one admin user (set `role = 'admin'` in profiles table)
