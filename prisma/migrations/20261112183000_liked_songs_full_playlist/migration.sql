-- Additive metadata for a user-authorized, resumable copy of Spotify Liked Songs.
CREATE TABLE "SpotifyLikedMirror" (
  "ownerId" TEXT NOT NULL,
  "spotifyAccountId" VARCHAR(255) NOT NULL,
  "spotifyPlaylistId" VARCHAR(64) NOT NULL,
  "nextOffset" INTEGER NOT NULL DEFAULT 0,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "syncLockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotifyLikedMirror_pkey" PRIMARY KEY ("ownerId")
);
ALTER TABLE "SpotifyLikedMirror"
  ADD CONSTRAINT "SpotifyLikedMirror_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpotifyLikedMirror" ENABLE ROW LEVEL SECURITY;
