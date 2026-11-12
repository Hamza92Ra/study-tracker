ALTER TABLE "UserSettings" ADD COLUMN "spotifyWidgetVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN "selectedSpotifyLinkId" VARCHAR(30);
CREATE TABLE "SpotifyLink" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" VARCHAR(10) NOT NULL,
  "spotifyId" VARCHAR(64) NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpotifyLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpotifyLink_ownerId_kind_spotifyId_key" ON "SpotifyLink"("ownerId", "kind", "spotifyId");
CREATE INDEX "SpotifyLink_ownerId_createdAt_idx" ON "SpotifyLink"("ownerId", "createdAt" DESC);
ALTER TABLE "SpotifyLink" ADD CONSTRAINT "SpotifyLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpotifyLink" ENABLE ROW LEVEL SECURITY;
