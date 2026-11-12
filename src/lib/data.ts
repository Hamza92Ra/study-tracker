import { prisma } from "./db";
import {
  addCalendarDays,
  dailyAllocation,
  localDay,
  startOfLocalDay,
  streaks,
  validDay,
  weeklySeries,
} from "./time";
import type { Prisma } from "@prisma/client";
import { cache } from "react";
export const publicOwner = cache(async function publicOwner(username?: string) {
  const select = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    biography: true,
    studyGoal: true,
    isActive: true,
    settings: { select: { timezone: true, profileVisibility: true } },
  } as const;
  const owner = username
    ? await prisma.user.findUnique({ where: { username }, select })
    : await prisma.user.findFirst({
        where: { role: "admin", isActive: true },
        orderBy: { createdAt: "asc" },
        select,
      });
  return owner?.isActive && owner.settings?.profileVisibility !== "private"
    ? owner
    : null;
});
export async function publicSummary(username?: string) {
  const owner = await publicOwner(username);
  if (!owner) return null;
  const [subjects, sessions] = await Promise.all([
    prisma.subject.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.studySession.findMany({
      where: {
        ownerId: owner.id,
        isPublic: true,
        subject: { ownerId: owner.id },
      },
      include: { subject: true },
      orderBy: { startedAt: "desc" },
    }),
  ]);
  const zone = owner.settings?.timezone ?? "Africa/Casablanca";
  const days = dailyAllocation(sessions, zone);
  const today = localDay(new Date(), zone);
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const stats = streaks(days, today);
  const weekly = weeklySeries(days, today);
  const thisWeek = weekly.at(-1)?.seconds ?? 0;
  const thisMonth = [...days]
    .filter(([day]) => day.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, [, seconds]) => sum + seconds, 0);
  const subjectTotals = new Map<string, { seconds: number; count: number }>();
  for (const session of sessions) {
    const total = subjectTotals.get(session.subjectId) ?? {
      seconds: 0,
      count: 0,
    };
    total.seconds += session.durationSeconds;
    total.count++;
    subjectTotals.set(session.subjectId, total);
  }
  const distribution = subjects
    .map((subject) => {
      const own = subjectTotals.get(subject.id);
      const seconds = own?.seconds ?? 0;
      return {
        ...subject,
        seconds,
        count: own?.count ?? 0,
        percent: totalSeconds ? (seconds / totalSeconds) * 100 : 0,
      };
    })
    .filter((s) => !s.isArchived || s.count)
    .sort((a, b) => b.seconds - a.seconds);
  return {
    owner,
    subjects,
    sessions,
    zone,
    days,
    today,
    totalSeconds,
    stats,
    weekly,
    thisWeek,
    thisMonth,
    distribution,
  };
}
export async function publicSubjectDistribution(username?: string) {
  const owner = await publicOwner(username);
  if (!owner) return null;
  const [subjects, totals] = await Promise.all([
    prisma.subject.findMany({ where: { ownerId: owner.id }, orderBy: { createdAt: "asc" } }),
    prisma.studySession.groupBy({
      by: ["subjectId"],
      where: { ownerId: owner.id, isPublic: true, subject: { ownerId: owner.id } },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
  ]);
  const bySubject = new Map(totals.map((row) => [row.subjectId, { seconds: row._sum.durationSeconds ?? 0, count: row._count._all }]));
  const totalSeconds = totals.reduce((sum, row) => sum + (row._sum.durationSeconds ?? 0), 0);
  const distribution = subjects.map((subject) => {
    const own = bySubject.get(subject.id);
    const seconds = own?.seconds ?? 0;
    return { ...subject, seconds, count: own?.count ?? 0, percent: totalSeconds ? seconds / totalSeconds * 100 : 0 };
  }).filter((subject) => !subject.isArchived || subject.count).sort((a, b) => b.seconds - a.seconds);
  return { owner, distribution, totalSeconds };
}
export async function publicSubjectDetail(username: string | undefined, slug: string) {
  const owner = await publicOwner(username);
  if (!owner) return null;
  const subject = await prisma.subject.findFirst({ where: { ownerId: owner.id, slug } });
  if (!subject) return null;
  const [sessions, total] = await Promise.all([
    prisma.studySession.findMany({ where: { ownerId: owner.id, subjectId: subject.id, isPublic: true }, include: { subject: true }, orderBy: { startedAt: "desc" } }),
    prisma.studySession.aggregate({ where: { ownerId: owner.id, isPublic: true, subject: { ownerId: owner.id } }, _sum: { durationSeconds: true } }),
  ]);
  if (subject.isArchived && sessions.length === 0) return null;
  const seconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  return { subject: { ...subject, seconds, count: sessions.length, percent: total._sum.durationSeconds ? seconds / total._sum.durationSeconds * 100 : 0 }, sessions, zone: owner.settings?.timezone ?? "Africa/Casablanca" };
}
export type HistoryFilters = {
  subject?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};
export async function activityPage(
  ownerId: string,
  zone: string,
  filters: HistoryFilters,
  publicOnly = true,
) {
  const requestedPage = Number(filters.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10));
  const where: Prisma.StudySessionWhereInput = {
    ownerId,
    subject: { ownerId, ...(filters.subject ? { slug: filters.subject } : {}) },
    ...(publicOnly ? { isPublic: true } : {}),
  };
  if (filters.search?.trim())
    where.title = {
      contains: filters.search.trim().slice(0, 160),
      mode: "insensitive",
    };
  if (filters.from || filters.to) {
    const from =
      filters.from && validDay(filters.from)
        ? startOfLocalDay(filters.from, zone)
        : undefined;
    const to =
      filters.to && validDay(filters.to)
        ? startOfLocalDay(addCalendarDays(filters.to, 1), zone)
        : undefined;
    where.AND = [
      ...(from ? [{ endedAt: { gt: from } }] : []),
      ...(to ? [{ startedAt: { lt: to } }] : []),
    ];
  }
  const [total, items] = await Promise.all([
    prisma.studySession.count({ where }),
    prisma.studySession.findMany({
      where,
      include: { subject: true },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
  };
}
