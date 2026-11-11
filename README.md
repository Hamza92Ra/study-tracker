# Study Ledger

A single-owner study tracker with a public learning journal and a private management workspace. Built with Next.js App Router, TypeScript, Tailwind, Radix/shadcn-style UI primitives, Motion, Recharts, Prisma, PostgreSQL, Auth.js (NextAuth), Zod, React Hook Form, Vitest and Playwright.

## What is included

- Public overview: profile, live statistics, twelve Monday–Sunday weeks, subject distribution, a 365-day heatmap, streaks and recent sessions.
- Public activity: server-side title search, subject/date filters and pagination.
- Subject pages: totals, session counts, weekly progress and recent history. Archived subjects with published history stay visible.
- Owner workspace: session and subject CRUD, private/public visibility, profile settings, daily goal, timer and range-filtered analytics.
- Credentials login, server-side authorization, rate limiting, validation and database row-level security.
- Metadata, Open Graph data, sitemap and robots exclusions for private routes.

## Database models

`User` owns `Subject`, `StudySession`, `StudyGoal`, `UserSettings` and `TimerState`. `LoginAttempt` stores failed login counts. Sessions have a unique idempotency key for timer saves. Subjects cannot be deleted while they have sessions. The initial migration enables RLS for every table. The app accesses PostgreSQL only from server code using Prisma; it exposes no Supabase Data API key to the browser.

## Local setup

1. Install Node.js 20.9 or newer and run `npm ci`.
2. Create a Supabase PostgreSQL project, or use another local PostgreSQL server. Copy `.env.example` to `.env` and enter your database URLs. Use a pooled transaction URL for `DATABASE_URL` and a direct URL for `DIRECT_URL`. Keep `.env` private.
3. Generate a random secret, e.g. `openssl rand -base64 32`, for `NEXTAUTH_SECRET`. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000` for local use.
4. Run `npm run db:migrate` and `npm run db:generate`.
5. Run `npm run owner:create`. The command asks for username, email, display name and a hidden password of at least 12 characters. For noninteractive setup, provide the first three values on stdin and `OWNER_PASSWORD` in the process environment. It refuses to create a second owner.
6. Run `npm run dev`, then open `http://localhost:3000`.

Optional development subjects: `DEMO_SEED=1 npm run db:seed`. The seed refuses to run when `NODE_ENV=production` and creates no fabricated sessions.

## Time and privacy policy

All timestamps are stored as UTC instants. Calendar statistics use the owner's IANA timezone, defaulting to `Africa/Casablanca`. Recorded duration is allocated across local dates in proportion to actual elapsed seconds between start and end. This handles midnight, daylight-saving changes and calendar boundaries. Weekly goal completion covers Monday through today. A paused timer retains its active seconds; when saved, those seconds are allocated proportionally across the timer's full wall-clock interval. Session history groups a session under its local **start** date. Private sessions are excluded from every public query and statistic. Setting profile visibility to private removes the owner profile from public pages.

The timer state lives in PostgreSQL, so an inactive tab or refresh does not lose it. Its display derives elapsed time from server timestamps. Saving uses a unique idempotency key. A timer is limited to one active state per owner.

## Testing

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `E2E_OWNER_USERNAME=... E2E_OWNER_PASSWORD=... npm run test:e2e` against a migrated local database and an owner account. Playwright starts a development server unless `E2E_BASE_URL` is set. The E2E test creates a uniquely named subject and session in the test database, then removes both.

Do not run the E2E suite against production: it writes records. A separate test database is recommended.

## Vercel deployment

1. Provision a Supabase project and configure its pooled and direct PostgreSQL connection strings. Run the committed migration with `npm run db:migrate` against the intended database **only after reviewing it**.
2. Create the owner with `npm run owner:create` in a trusted environment connected to that database.
3. Import the repository into Vercel. Use the default Next.js preset. The build command is `npm run build`.
4. Add the production environment variables below. Use the production URL for both site URLs and a fresh random secret. Do not prefix database credentials or the auth secret with `NEXT_PUBLIC_`.
5. Deploy and verify login, session entry and public visibility. This repository has not been deployed by this task.

### Production environment checklist

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase pooled transaction connection, with `pgbouncer=true` for Prisma 6. |
| `DIRECT_URL` | Direct PostgreSQL connection for migrations. |
| `NEXTAUTH_URL` | Canonical HTTPS deployment URL. |
| `NEXTAUTH_SECRET` | Random secret of at least 32 bytes. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public HTTPS URL for metadata and sitemap. |

Auth.js issues HTTP-only session cookies, uses SameSite defaults and secure cookies on HTTPS, and includes CSRF protection for credential sign-in. Next.js server actions check request origin; every management action additionally checks the authenticated owner and scopes database writes by owner ID. Keep a database backup before migrations.

## Current constraints

The first version is single-owner with no registration. Public analytics currently load the owner's public session records to calculate exact cross-midnight daily allocations; for very large histories, move these calculations into a maintained daily summary table. The test suite covers aggregation and one browser CRUD/publication flow; it needs a local PostgreSQL instance for browser verification.
