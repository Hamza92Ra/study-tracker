-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "biography" VARCHAR(500),
    "studyGoal" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "color" VARCHAR(7) NOT NULL DEFAULT '#7c3aed',
    "icon" VARCHAR(30) NOT NULL DEFAULT 'book',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGoal" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dailyTargetMinutes" INTEGER NOT NULL DEFAULT 180,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Africa/Casablanca',
    "profileVisibility" VARCHAR(10) NOT NULL DEFAULT 'public',
    "themePreference" VARCHAR(10) NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimerState" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "runningSince" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(10) NOT NULL DEFAULT 'running',
    "saveKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedAt" TIMESTAMP(3),

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Subject_ownerId_isArchived_idx" ON "Subject"("ownerId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_ownerId_slug_key" ON "Subject"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "StudySession_idempotencyKey_key" ON "StudySession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StudySession_ownerId_startedAt_idx" ON "StudySession"("ownerId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "StudySession_subjectId_startedAt_idx" ON "StudySession"("subjectId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "StudySession_ownerId_isPublic_startedAt_idx" ON "StudySession"("ownerId", "isPublic", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyGoal_ownerId_key" ON "StudyGoal"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_ownerId_key" ON "UserSettings"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "TimerState_ownerId_key" ON "TimerState"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "TimerState_saveKey_key" ON "TimerState"("saveKey");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_key_key" ON "LoginAttempt"("key");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyGoal" ADD CONSTRAINT "StudyGoal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerState" ADD CONSTRAINT "TimerState_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Server-only Prisma connections own access. Browser Data API roles get no policies.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimerState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginAttempt" ENABLE ROW LEVEL SECURITY;
