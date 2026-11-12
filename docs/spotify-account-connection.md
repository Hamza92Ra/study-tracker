# Spotify account connection for Study Ledger

The Spotify player is still available with pasted playlist/album links. This upgrade
also links a user's Spotify identity to their **own** authenticated workspace.

## One-time Spotify developer setup

1. Sign in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Register a Spotify app for Study Ledger. Use the **Web API**.
3. Add this exact Redirect URI (including https and path):
   `https://study-tracker-delta-three.vercel.app/api/spotify/callback`
4. Copy **Client ID** (not Client Secret). Add `SPOTIFY_CLIENT_ID` as an environment
   variable to the `study-tracker` Vercel project, scoped to **production**.
   Redeploy the application after adding it. Do not prefix this with `NEXT_PUBLIC_`.
5. For preview testing, register the exact preview URL + `/api/spotify/callback`
   in Spotify and set the same Client ID for that preview environment.
6. In Spotify Development Mode, the app owner must have **Spotify Premium**.
   Add up to **5 Spotify users** to the allowlist. Your Study Ledger user accounts
   are separate from that Spotify allowlist.

No Client Secret is required: the connection uses Authorization Code + PKCE.
Access and refresh tokens are encrypted at rest using AES-256-GCM and a
domain-separated key derived from the already-configured server-only
`NEXTAUTH_SECRET`. If that authentication secret changes, stored Spotify
connections will need to be reconnected.

## What connected users can do

- Click **Connect Spotify** on their Study Ledger overview.
- Authorize `user-read-private`, `playlist-read-private`, and `user-library-read` scopes.
- See their Spotify name, photo and Spotify profile link.
- Click **Load my playlists** (first 20 playlists) and add one to their player.
- Click **Load Liked Songs** to browse saved tracks in pages of 20 and add individual tracks to the embedded player.
- Collapse or expand account/library details independently of the player; this preference is remembered per Study Ledger user in the browser.
- Existing Spotify connections must use **Reconnect Spotify for Liked Songs** to authorize the new `user-library-read` scope.
- Disconnect Spotify without losing playlist embeds saved in Study Ledger.

The user's Spotify Liked Songs collection is not an embeddable playlist. Imported single-track embeds do not automatically play the entire Liked Songs collection sequentially.

Spotify embedded playback is handled by Spotify, and full-track playback may
require signing into Spotify or a Premium account. Account linking does not turn
the web embed into a remote Spotify playback controller.

## Security and database

- The application verifies a 10-minute, signed, HttpOnly OAuth state cookie
  tied to the currently logged-in Study Ledger account.
- Spotify account ID (`account_id`, immutable) is unique across Study Ledger
  users; linked credentials never go to the browser.
- The database migration adds `SpotifyAccount` with RLS enabled and no public
  policies. All authorized writes and reads are performed server-side, scoped to
  the signed-in Study Ledger user's ID.
- The original `SpotifyLink` table and all existing study records remain unchanged.
- The existing Supabase migration history was recorded outside Prisma.
  **Do not run the original Prisma migrations on production.**
  Use the additive new migration through the Supabase migration integration.

After production deployment, verify sign-in, account linking, playlist import,
and account disconnection with a real Spotify allowlisted user.
