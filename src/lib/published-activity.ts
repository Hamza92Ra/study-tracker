import { prisma } from './db'
import { requireAdmin } from './auth'
import { usernameSchema } from './account-validation'
import { addCalendarDays, dailyAllocation, localDay, startOfLocalDay, validDay, weekStart, weeklySeries } from './time'
import type { Prisma } from '@prisma/client'

export type PublishedFilters = { username?: string; subject?: string; from?: string; to?: string; page?: string }

/** Every entry point is authorized before any cross-account query runs. */
export async function publishedActivity(raw: PublishedFilters) {
  const admin = await requireAdmin()
  const zone = (await prisma.userSettings.findUnique({ where: { ownerId: admin.id }, select: { timezone: true } }))?.timezone ?? 'Africa/Casablanca'
  const username = usernameSchema.safeParse(raw.username?.trim().toLowerCase()).data
  const subjectId = raw.subject && /^[a-z0-9]{15,40}$/i.test(raw.subject) ? raw.subject : undefined
  const from = raw.from && validDay(raw.from) ? raw.from : undefined
  const to = raw.to && validDay(raw.to) ? raw.to : undefined
  const requested = Number(raw.page)
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 100_000) : 1
  const pageSize = 20
  const published: Prisma.StudySessionWhereInput = { isPublic: true }
  const where: Prisma.StudySessionWhereInput = {
    ...published,
    ...(username ? { owner: { username } } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...((from || to) ? { AND: [
      ...(from ? [{ endedAt: { gt: startOfLocalDay(from, zone) } }] : []),
      ...(to ? [{ startedAt: { lt: startOfLocalDay(addCalendarDays(to, 1), zone) } }] : []),
    ] } : {}),
  }
  const today = localDay(new Date(), zone)
  const firstWeek = addCalendarDays(weekStart(today), -77)
  const [users, groups, filteredCount, sessions, recent] = await Promise.all([
    prisma.user.findMany({
      orderBy: { username: 'asc' },
      select: { id: true, username: true, displayName: true, avatarUrl: true, isActive: true, settings: { select: { profileVisibility: true } } },
    }),
    prisma.studySession.groupBy({ by: ['ownerId', 'subjectId'], where: published, _sum: { durationSeconds: true }, _count: { _all: true } }),
    prisma.studySession.count({ where }),
    prisma.studySession.findMany({
      where,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, title: true, startedAt: true, endedAt: true, durationSeconds: true,
        owner: { select: { username: true, displayName: true } },
        subject: { select: { id: true, name: true, color: true, ownerId: true } },
      },
    }),
    prisma.studySession.findMany({
      where: { ...published, endedAt: { gt: startOfLocalDay(firstWeek, zone) }, startedAt: { lt: startOfLocalDay(addCalendarDays(today, 1), zone) } },
      select: { startedAt: true, endedAt: true, durationSeconds: true },
    }),
  ])
  const subjectIds = groups.map(row => row.subjectId)
  const subjects = subjectIds.length ? await prisma.subject.findMany({
    where: { id: { in: subjectIds } }, select: { id: true, ownerId: true, name: true, color: true },
  }) : []
  const bySubject = new Map(subjects.map(subject => [subject.id, subject]))
  const byUser = new Map(users.map(user => [user.id, user]))
  const ownerSeconds = new Map<string, number>()
  const subjectTotals = groups.flatMap(row => {
    const subject = bySubject.get(row.subjectId)
    if (!subject || subject.ownerId !== row.ownerId) return []
    const seconds = row._sum.durationSeconds ?? 0
    ownerSeconds.set(row.ownerId, (ownerSeconds.get(row.ownerId) ?? 0) + seconds)
    return [{ ...subject, username: byUser.get(row.ownerId)?.username ?? '', seconds, count: row._count._all }]
  }).sort((a, b) => b.seconds - a.seconds)
  const people = users.map(user => ({ ...user, seconds: ownerSeconds.get(user.id) ?? 0 }))
  const totalSeconds = people.reduce((sum, user) => sum + user.seconds, 0)
  const weekly = weeklySeries(dailyAllocation(recent, zone), today)
  return { people, subjectTotals, totalSeconds, filteredCount, sessions, weekly, zone, page,
    pages: Math.max(1, Math.ceil(filteredCount / pageSize)), pageSize,
    filters: { username: username ?? '', subject: subjectId ?? '', from: from ?? '', to: to ?? '' } }
}
