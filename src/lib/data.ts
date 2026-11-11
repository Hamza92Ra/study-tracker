import { prisma } from './db'
import { addCalendarDays, dailyAllocation, localDay, startOfLocalDay, streaks, validDay, weeklySeries } from './time'
import type { Prisma } from '@prisma/client'
export async function publicOwner() {
  const owner = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, include: { settings: true, goal: true } })
  return owner?.settings?.profileVisibility === 'private' ? null : owner
}
export async function publicSummary() {
  const owner = await publicOwner()
  if (!owner) return null
  const [subjects, sessions] = await Promise.all([
    prisma.subject.findMany({ where: { ownerId: owner.id }, orderBy: { createdAt: 'asc' } }),
    prisma.studySession.findMany({ where: { ownerId: owner.id, isPublic: true }, include: { subject: true }, orderBy: { startedAt: 'desc' } })
  ])
  const zone = owner.settings?.timezone ?? 'Africa/Casablanca'
  const days = dailyAllocation(sessions, zone)
  const today = localDay(new Date(), zone)
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0)
  const stats = streaks(days, today)
  const weekly = weeklySeries(days, today)
  const thisWeek = weekly.at(-1)?.seconds ?? 0
  const thisMonth = [...days].filter(([day]) => day.slice(0,7) === today.slice(0,7)).reduce((sum,[,seconds]) => sum + seconds, 0)
  const distribution = subjects.map(subject => { const own = sessions.filter(s => s.subjectId === subject.id); const seconds = own.reduce((sum,s)=>sum+s.durationSeconds,0); return { ...subject, seconds, count: own.length, percent: totalSeconds ? Math.round(seconds/totalSeconds*100) : 0 } }).filter(s => !s.isArchived || s.count).sort((a,b)=>b.seconds-a.seconds)
  return { owner, subjects, sessions, zone, days, today, totalSeconds, stats, weekly, thisWeek, thisMonth, distribution }
}
export type HistoryFilters = { subject?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }
export async function activityPage(ownerId: string, zone: string, filters: HistoryFilters, publicOnly = true) {
  const page = Math.max(1, Math.floor(Number(filters.page) || 1)); const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10))
  const where: Prisma.StudySessionWhereInput = { ownerId, ...(publicOnly ? { isPublic: true } : {}) }
  if (filters.subject) where.subject = { slug: filters.subject }
  if (filters.search?.trim()) where.title = { contains: filters.search.trim().slice(0,160), mode: 'insensitive' }
  if (filters.from || filters.to) {
    const from = filters.from && validDay(filters.from) ? startOfLocalDay(filters.from,zone) : undefined
    const to = filters.to && validDay(filters.to) ? startOfLocalDay(addCalendarDays(filters.to,1),zone) : undefined
    where.AND = [ ...(from ? [{ endedAt: { gt: from } }] : []), ...(to ? [{ startedAt: { lt: to } }] : []) ]
  }
  const [total, items] = await Promise.all([
    prisma.studySession.count({ where }),
    prisma.studySession.findMany({ where, include: { subject: true }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], skip: (page-1)*pageSize, take: pageSize })
  ])
  return { items, total, page, pages: Math.max(1,Math.ceil(total/pageSize)), pageSize }
}
