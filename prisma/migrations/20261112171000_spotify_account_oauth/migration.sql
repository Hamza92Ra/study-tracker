-- Independent Spotify OAuth identities. Existing SpotifyLink rows are preserved.
CREATE TABLE "SpotifyAccount" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "spotifyAccountId" VARCHAR(255) NOT NULL,
  "displayName" VARCHAR(128) NOT NULL,
  "avatarUrl" VARCHAR(500),
  "profileUrl" VARCHAR(500),
  "encryptedAccessToken" TEXT NOT NULL,
  "encryptedRefreshToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotifyAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpotifyAccount_ownerId_key" ON "SpotifyAccount"("ownerId");
CREATE UNIQUE INDEX "SpotifyAccount_spotifyAccountId_key" ON "SpotifyAccount"("spotifyAccountId");
ALTER TABLE "SpotifyAccount" ADD CONSTRAINT "SpotifyAccount_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- User-based authorization lives in NextAuth server actions, never the public Data API.
ALTER TABLE "SpotifyAccount" ENABLE ROW LEVEL SECURITY;
