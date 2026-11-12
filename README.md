# Study Ledger

A multi-user study tracker with private workspaces, public learning profiles, and an admin-only People dashboard. Built with Next.js 16, React 19, TypeScript, Prisma 6, Supabase PostgreSQL, NextAuth, Tailwind, Recharts, Zod, React Hook Form, Vitest, and Playwright.

## Features

- Private workspace: timer, session and subject management, goals, analytics, settings, and a compact Spotify Embed widget. Each account owns its own data. The timer persists in PostgreSQL and uses an idempotency key when saving.
- Spotify: save multiple playlist or album links, switch between them, and hide or show the player. The official iframe Embed needs no Spotify API credentials and never autoplays. Spotify may require a listener to sign in for full playback.
- Public profiles: `/u/{username}`, with scoped activity and subject pages. Only active accounts with public profile visibility are accessible. Only published sessions contribute to public history and statistics. `/` remains the original admin's public homepage.
- Admin: create and manage members, reset passwords, and assign roles. Admin access is checked on the server. New members start with private profiles and must change their temporary password.
- Settings: change your own normalized, unique username, profile photo, display name, goal, theme, and timezone. Study history is related by user ID, so a username change does not move or delete records.
- Responsive navigation and mobile cards, charts, forms, and People table. The original brand asset is used in the header, login, and a small-size icon.

## Local setup

1. Use Node.js 22 or newer. Run `npm ci`.
2. Copy `.env.example` to `.env` and fill in a **development database**, not production. Use a pooled PostgreSQL URL for `DATABASE_URL` and a direct URL for `DIRECT_URL`. Generate a fresh `NEXTAUTH_SECRET` with at least 32 random bytes.
3. On a new, empty database, run `npm run db:migrate` and `npm run db:generate`. Then run `npm run owner:create` to create the first administrator. The script asks for username, email, display name, and a password of at least 12 characters.
4. Run `npm run dev` and open `http://localhost:3000`.

Optional development subjects: `DEMO_SEED=1 npm run db:seed`. This creates no study sessions and refuses to run in production.

### Existing database migration

The original schema in this project was applied through Supabase's migration system. **Do not blindly run `prisma migrate deploy` against an existing database.** Review the actual schema and migration history first. The new additive migration is [20261112120000_spotify_links/migration.sql](prisma/migrations/20261112120000_spotify_links/migration.sql). It adds two `UserSettings` columns and a `SpotifyLink` table. It does not alter or delete existing users, credentials, subjects, sessions, or settings.

For an existing database, take a backup, apply only the missing additive SQL through the database's established migration process, and reconcile Prisma migration bookkeeping for migrations already applied by Supabase before using Prisma deploy. Apply and verify the migration on a separate development or preview database first. Do not point a preview deployment at a production database that lacks this migration: private workspace reads will fail until the schema is updated.

## Data and security

All study timestamps are stored in UTC. Calendar calculations use each owner's configured IANA timezone (default: Casablanca). Sessions crossing local midnight are allocated across dates in proportion to elapsed time. A paused timer's recorded duration is distributed over its full start-to-stop interval. History groups sessions under their local start date.

Every management action authenticates the account and scopes writes by owner ID. Public queries scope by owner ID and published visibility; private or suspended profiles return 404. Username uniqueness is enforced by PostgreSQL and validated in the server action. Login sessions are HTTP-only, with credential-version invalidation after password changes or account suspension. Spotify URLs are restricted to canonical HTTPS `open.spotify.com` playlist and album IDs before being placed in an iframe.

The database has RLS enabled. The application connects to PostgreSQL only from server code; no privileged database credentials or Spotify API keys are sent to the browser. Keep the database credentials and auth secret out of `NEXT_PUBLIC_` variables.

## Tests

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `E2E_OWNER_USERNAME=... E2E_OWNER_PASSWORD=... npm run test:e2e` against a **migrated, isolated test database**. The Playwright flow creates and deletes test study records, changes the test account username temporarily, and saves a Spotify link. Never run it against production.
- `RUN_DB_TESTS=1 npm run test` enables the database integration test. It writes temporary rows and must also use an isolated database.

Unit tests cover username normalization and conflicts, public owner isolation and pagination, Spotify URL validation, role policy, and calendar allocation. Database and browser write tests are skipped without a separate test database.

## Vercel deployment

1. Configure Preview with its own migrated database and separate auth secret and site URLs. Confirm the Preview `DATABASE_URL` and `DIRECT_URL` point to that database.
2. Push a feature branch and inspect its preview deployment. Verify public and private flows, including 320px and 390px layouts.
3. Before production rollout, review the additive migration and back up production. Apply it through the established Supabase migration process, verify it, then deploy the reviewed commit. Do not deploy application code that expects new columns before the migration.
4. Set these environment variables in Vercel for each environment:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL connection for Prisma. |
| `DIRECT_URL` | Direct connection used by migrations. |
| `NEXTAUTH_URL` | Canonical HTTPS URL for this deployment. |
| `NEXTAUTH_SECRET` | Random secret of at least 32 bytes. |
| `NEXT_PUBLIC_SITE_URL` | Public origin for metadata and sitemap. |

No Spotify developer credentials are needed for the Embed feature. Spotify OAuth or the Web Playback SDK would require a Spotify developer app, client ID, server-held client secret, redirect URIs, and consent scopes; neither is implemented here.

## Performance notes

Public analytics currently load published session timestamps to calculate exact local-day allocation; private overview does the same for the signed-in user. Subject totals are reduced in one pass. Large histories may warrant a maintained daily summary table later. Recent private sessions use a separate five-row query so notes and subject details are not fetched for the entire history.
