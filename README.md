# Banquet Ordering PWA

Staff-only Progressive Web App for hotel-style banquet service: managers configure events (menu, tables), waiters place per-seat orders, and kitchen advances order status with Supabase Realtime.

## Requirements

- Node.js 20+
- A [Supabase](https://supabase.com) project

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment variables

Copy the example file and fill in values from Supabase **Project Settings → API**:

```bash
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never commit `.env.local` or use the `service_role` key in the browser.

### 3. Apply database migrations

Run the SQL files in [`supabase/migrations/`](supabase/migrations/) **in filename order** on your Supabase database:

- **Dashboard**: SQL Editor → paste each file’s contents → Run.
- **CLI** (recommended once linked): from the project root, `supabase link` then `supabase db push` (requires `supabase init` + `config.toml` if you do not already have them).
- **Release checklist**: after schema changes, run migrations on production and regenerate types (`npm run db:types`).

The initial schema defines tables, RLS, Realtime on `orders`, and the `advance_order_status` RPC for kitchen status changes.

Later migrations add **floor plans**, **L-shape** layout, **order audit logging** (`order_audit_log` + trigger on `orders`), optional **`layout_config`** on `banquet_tables` for custom L legs, tighten **profile** visibility (managers no longer have blanket `SELECT` on all `profiles` rows), **`seat_guest_notes`** for per-seat kitchen notices, and **`20260214120000_menu_courses.sql`** (`menu_course` on menu items and orders, one open order per seat per course, max three labels per course).

### 4. Enable email (password) authentication

In Supabase Dashboard: **Authentication → Providers → Email** — enable email/password sign-in (and disable public sign-up if you only create users from the dashboard).

### 5. First staff user and manager role

1. Create a user: **Authentication → Users → Add user** (or invite).
2. The trigger `on_auth_user_created` inserts a `profiles` row (default role `waiter`).
3. Promote your admin user to manager by running the SQL in [`supabase/bootstrap_manager.sql`](supabase/bootstrap_manager.sql) (replace the placeholder UUID).

## Develop

```bash
npm run dev
```

```bash
npm test
```

Runs [Vitest](https://vitest.dev/) unit tests (domain helpers). Use `npm run test:watch` while developing.

End-to-end smoke (creates a real event, menu row, table, order, then kitchen steps) with [Playwright](https://playwright.dev/):

```bash
npm run test:e2e
```

Add `E2E_EMAIL` and `E2E_PASSWORD` to `.env.local` (same **manager** account you use in the browser). Without them, the E2E spec is skipped. The dev server is started automatically unless something is already listening on port 3000 (`reuseExistingServer`).

**E2E stability:** The flow spec waits for the client bundle and adds short delays around hydration-sensitive steps. If it flakes on a slow machine, re-run `npm run test:e2e` or increase timeouts in [`e2e/banquet-flow.spec.ts`](e2e/banquet-flow.spec.ts). Ensure the manager account can create events and that migrations through menu courses are applied.

The PWA service worker is **disabled in development** ([`next.config.ts`](next.config.ts)); use a production build to verify installability and caching.

```bash
npm run build
npm start
```

## Version control

If this folder is not yet a Git repository, run `git init` in the project root (or clone from your remote). Vercel and similar hosts expect a Git remote for continuous deployment.

## Deploy on Vercel

### One-time: Git remote

Vercel deploys from Git. Push this repo to **GitHub**, **GitLab**, or **Bitbucket** (see [Version control](#version-control) above).

### 1. Create the Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub login is fine).
2. **Add New… → Project** → **Import** your `banquet-ordering-pwa` repository.
3. Vercel should detect **Next.js** automatically. Leave defaults unless you use a monorepo (then set **Root Directory**).
4. Under **Environment Variables**, add (same names as `.env.example`):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon** public key (not `service_role`) |

   Get both from Supabase: **Project Settings → API**.

5. Click **Deploy**. Wait for the build to finish; open the **Production** URL (e.g. `https://banquet-ordering-pwa-xxx.vercel.app`).

### 2. Database and auth (production Supabase)

1. Run all [`supabase/migrations/`](supabase/migrations/) on the **same** Supabase project you pointed the env vars at (same as local step 3).
2. **Authentication → URL configuration** (Supabase):

   - **Site URL**: your Vercel production URL, e.g. `https://your-app.vercel.app`
   - **Redirect URLs**: add that same URL, and optionally preview URLs, e.g. `https://*.vercel.app/*` (so Preview deployments can log in)

   Without this, email/password redirects after login can fail on production.

### 3. Smoke test after deploy

Log in on the live URL, then run through: manager event, waiter order, kitchen board, Realtime. Staff roles and RLS apply the same as locally.

### 4. Install the waiter PWA on a phone

Production builds enable the service worker ([`next.config.ts`](next.config.ts)). On the phone, open your **HTTPS** Vercel URL in **Safari** (iOS) or **Chrome** (Android), sign in, open **Waiter**, then **Add to Home Screen** / **Install app** from the browser menu.

## TypeScript types

Regenerate [`lib/database.types.ts`](lib/database.types.ts) when you change the database schema:

1. Install and log in to the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. From the project root: `supabase link` (once per machine) to your project.
3. Run `npm run db:types` (writes `lib/database.types.ts`; on Windows you may run the underlying `supabase gen types` command manually if shell redirection differs).

## Project layout

- [`app/`](app/) — Next.js App Router: `/login`, `/manager`, `/waiter`, `/kitchen`
- [`lib/actions/`](lib/actions/) — Server Actions (auth, manager, waiter)
- [`hooks/useOrdersRealtime.ts`](hooks/useOrdersRealtime.ts) — Supabase Realtime subscription for `orders`
- [`supabase/migrations/`](supabase/migrations/) — Postgres schema, RLS, triggers, RPCs

## Security notes

- Client code must use only the **anon** key; keep `service_role` server-side only if you add admin scripts.
- Kitchen status changes go through **`advance_order_status`** only; avoid granting kitchen broad `UPDATE` on `orders`. Managers may also call this RPC so they can use the kitchen board when covering service.
- New orders require the event to be **active** (app check + RLS); see migration `20250412100000_orders_require_active_event.sql`.
- Production builds set baseline HTTP headers (frame options, nosniff, referrer policy, HSTS); tighten CSP as your deployment allows.
- Waiters may delete **pending** orders only (RLS + `cancelPendingOrder` server action) to fix mistakes before the kitchen cooks.
