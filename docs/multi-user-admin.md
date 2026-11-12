# Multi-user administration

Study Ledger supports one administrator and independently owned member workspaces.

## Roles and access

- The original account is migrated to `admin` without changing its study history.
- The **People** page (`/manage/admin`) is shown only to the administrator.
- Members share the sign-in URL `/manage/login`. Each sees only their own subjects, sessions, timer, goals, analytics, and settings. Server actions always scope records to the authenticated account.
- The public landing page continues to show the original administrator's public profile only; member data is **not** published to it.
- An administrator can create, suspend, reactivate, and reset member passwords. Accounts are suspended rather than deleted to preserve study history.

## Inviting a member

1. Sign in as admin and open **People**.
2. Fill in display name, username, email, and click **Create member account**.
3. Copy the one-time temporary password shown immediately. Share it privately with the new member.
4. The member signs in with their username and temporary password, then changes it at the first-login prompt. New passwords must be at least 12 characters.
5. Resetting a password or suspending an account revokes its prior login sessions.

There is no automatic invitation email or public registration. Never paste temporary passwords into public channels or logs.

## Database migration

The additive Prisma migration `20261112000000_multi_user_admin` adds role, active status, credential version and password-change state. It preserves all existing records, promotes the original oldest account to admin, and leaves RLS enabled.

**Important:** The initial migration was previously applied through Supabase's migration system, not Prisma's `_prisma_migrations` table. Before switching to Prisma-managed `migrate deploy`, baseline the original and this migration with `prisma migrate resolve --applied` using a compatible direct/session-pooler connection, after verifying the tables and migration states. Do **not** reapply the initial SQL against existing tables.

The production web build runs `prisma generate && next build` and does not automatically execute migrations. Apply the new additive schema migration before releasing this version.
