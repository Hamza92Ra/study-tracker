/**
 * Disposable PostgreSQL test seed. Hard-fails unless connected to localhost.
 * This script must NEVER be used with Supabase production or preview databases.
 */
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { encryptSpotifyToken } from '../src/lib/spotify-oauth'

const url = process.env.DATABASE_URL
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('CI seeding is only allowed on a local disposable PostgreSQL database.')
}
if (process.env.RUN_DB_TESTS !== '1') {
  throw new Error('CI seed is disabled outside isolated database testing.')
}
const prisma = new PrismaClient()
const password = process.env.E2E_OWNER_PASSWORD
if (!password || password.length < 12) throw new Error('Missing CI-only owner password')

async function main() {
  if (await prisma.user.count()) throw new Error('CI seed requires an empty database.')
  const passwordHash = await hash(password!, 10)
  const admin = await prisma.user.create({
    data: {
      username: 'ci_owner', email: 'ci_owner@example.test', displayName: 'CI Owner',
      role: 'admin', passwordHash,
      settings: { create: { timezone: 'Africa/Casablanca', profileVisibility: 'public' } },
      goal: { create: { dailyTargetMinutes: 180 } },
    },
  })
  // A fake identity verifies the account panel without contacting Spotify.
  await prisma.spotifyAccount.create({
    data: {
      ownerId: admin.id,
      spotifyAccountId: 'ci-spotify-user',
      displayName: 'CI Spotify Tester',
      encryptedAccessToken: encryptSpotifyToken('ci-only-no-network-access-token'),
      encryptedRefreshToken: encryptSpotifyToken('ci-only-no-network-refresh-token'),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  })
  const member = await prisma.user.create({
    data: {
      username: 'ci_member', email: 'ci_member@example.test', displayName: 'CI Member',
      role: 'member', passwordHash,
      settings: { create: { timezone: 'Africa/Casablanca', profileVisibility: 'public' } },
      goal: { create: { dailyTargetMinutes: 90 } },
    },
  })
  const privateUser = await prisma.user.create({
    data: {
      username: 'ci_private', email: 'ci_private@example.test', displayName: 'CI Private',
      role: 'member', passwordHash,
      settings: { create: { timezone: 'Africa/Casablanca', profileVisibility: 'private' } },
    },
  })
  const memberSubject = await prisma.subject.create({
    data: { ownerId: member.id, name: 'Public Demo Subject', slug: 'public-demo-subject', color: '#1c8056', icon: 'book' },
  })
  const privateSubject = await prisma.subject.create({
    data: { ownerId: privateUser.id, name: 'Private Profile Subject', slug: 'private-profile-subject', color: '#2c8056', icon: 'book' },
  })
  const now = Date.now()
  const base = { startedAt: new Date(now-2*3600_000), endedAt: new Date(now-3600_000), durationSeconds: 3600 }
  await prisma.studySession.createMany({
    data: [
      { ...base, ownerId: member.id, subjectId: memberSubject.id, title: 'Published CI Member Session', isPublic: true },
      { ...base, ownerId: member.id, subjectId: memberSubject.id, title: 'Hidden CI Member Session', isPublic: false },
      { ...base, ownerId: privateUser.id, subjectId: privateSubject.id, title: 'Hidden CI Private Profile Session', isPublic: true },
    ],
  })
  console.log('Seeded isolated CI users: admin, member, and private-profile member.')
  if (!admin) throw new Error('Failed to create the local test administrator')
}
main().finally(() => prisma.$disconnect())
