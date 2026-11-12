-- Additive multi-account migration. Existing study records and owner IDs are untouched.
ALTER TABLE "User"
  ADD COLUMN "role" VARCHAR(10) NOT NULL DEFAULT 'member',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- The oldest account is the original single owner. Keep their account as admin.
UPDATE "User" SET "role" = 'admin'
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);

CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- Row-level security stays enabled and no public Data API access is granted.
