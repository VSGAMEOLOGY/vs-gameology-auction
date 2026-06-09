# VS GAMEOLOGY Auction Platform

A production-ready auction platform built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

## Features

### User Features
- Registration and login (Supabase Auth)
- Profile management
- Multiple shipping addresses with default selection
- Browse and search auctions
- Real-time bidding with live updates
- Bid history
- Auction watchlist
- Winner notifications and payment tracking
- Shipping fee support
- Collection or shipping fulfillment options
- In-app notifications

### Admin Features
- Dashboard with key metrics
- User management (promote to admin, suspend, blacklist)
- Auction management (create, edit, draft, schedule, clone)
- Bulk auction creation and scheduling
- Schedule preview (timeline view + inline form preview)
- Payment verification
- Suspension and blacklist management
- Activity audit logs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database & Auth | Supabase (PostgreSQL + Auth + Realtime) |
| Deployment | Vercel |

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login & register
│   │   ├── admin/              # Admin panel
│   │   ├── api/                # API routes (cron, auth callback)
│   │   ├── auctions/           # Public auction pages
│   │   ├── profile/            # User profile & addresses
│   │   ├── payments/           # Payment management
│   │   ├── watchlist/          # User watchlist
│   │   └── notifications/      # User notifications
│   ├── components/             # React components
│   │   ├── admin/              # Admin-specific components
│   │   ├── auctions/           # Auction & bidding components
│   │   ├── layout/               # Header, footer
│   │   ├── profile/            # Profile components
│   │   └── ui/                   # Reusable UI primitives
│   ├── lib/                    # Utilities & Supabase clients
│   └── types/                    # TypeScript types
├── supabase/
│   ├── migrations/             # Database schema
│   ├── config.toml               # Supabase local config
│   └── seed.sql                  # Seed data
├── public/                       # Static assets
└── vercel.json                   # Vercel deployment config
```

## Setup Instructions

### Prerequisites

- [Node.js](https://nodejs.org/) 18.17 or later
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- A [Supabase](https://supabase.com/) account
- A [Vercel](https://vercel.com/) account (for deployment)

### 1. Clone and Install

```bash
cd VS-GAMEOLOGY-AUCTION
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Wait for the database to provision.
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Run Database Migration

1. Open **Supabase Dashboard → SQL Editor**.
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`.
3. Paste and run the SQL.

This creates all tables, triggers, RLS policies, and realtime subscriptions.

### 4. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=VS GAMEOLOGY Auction
CRON_SECRET=generate-a-random-secret-string
```

### 5. Configure Supabase Auth

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (or your production URL)
- **Redirect URLs**: Add `http://localhost:3000/api/auth/callback`

Enable **Email** provider under **Authentication → Providers**.

### 6. Enable Realtime

In **Supabase Dashboard → Database → Replication**, ensure these tables are enabled for realtime:
- `bids`
- `auctions`
- `notifications`

(The migration script adds these to the publication automatically.)

### 7. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 8. Create Admin User

1. Register a new account at `/register`.
2. In **Supabase Dashboard → SQL Editor**, run:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
```

3. Log in and access the admin panel at `/admin`.

## Vercel Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial VS GAMEOLOGY auction platform"
git remote add origin https://github.com/your-org/vs-gameology-auction.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import your GitHub repository.
3. Framework preset: **Next.js** (auto-detected).

### 3. Set Environment Variables

In Vercel project **Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel domain (e.g. `https://auction.vsgameology.com`) |
| `NEXT_PUBLIC_APP_NAME` | `VS GAMEOLOGY Auction` |
| `CRON_SECRET` | Same random secret from `.env.local` |

### 4. Update Supabase Auth URLs

In Supabase **Authentication → URL Configuration**, add your Vercel URL:
- Site URL: `https://your-domain.vercel.app`
- Redirect URL: `https://your-domain.vercel.app/api/auth/callback`

### 5. Deploy

Vercel deploys automatically on push. The cron job in `vercel.json` runs every minute to:
- Activate scheduled auctions
- End expired auctions and select winners

## Cron Job

The `/api/cron/auctions` endpoint is protected by `CRON_SECRET`. Vercel Cron sends this automatically. For manual testing:

```bash
curl -H "Authorization: Bearer your-cron-secret" https://your-domain.vercel.app/api/cron/auctions
```

## Bulk Auction Import Format

In Admin → Auctions → Bulk Create, use pipe-separated values per line:

```
Title | Description | Starting Price | Bid Increment | Shipping Fee | shipping/collection
```

Example:

```
Pokemon Card PSA 10 | Charizard 1st Edition | 500 | 25 | 15 | shipping
Vintage Game Console | NES in box | 200 | 10 | 0 | collection
```

## Database Schema Overview

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `shipping_addresses` | Multiple addresses per user |
| `auctions` | Auction listings with scheduling |
| `bids` | Bid records with realtime updates |
| `watchlist` | User auction watchlists |
| `payments` | Winner payment tracking |
| `notifications` | In-app user notifications |
| `blacklist` | Permanently banned emails |
| `suspension_history` | Suspension audit trail |
| `admin_activity_logs` | Admin action audit trail |

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm run typecheck  # TypeScript check
```

## Security

- Row Level Security (RLS) on all tables
- Suspended users blocked from bidding
- Blacklisted emails blocked at registration
- Admin routes protected by middleware
- Cron endpoint protected by bearer token
- Service role key only used server-side

## License

Proprietary — VS GAMEOLOGY. All rights reserved.
