import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdmin, findSettings, findUsers, groupSessions, countSessions, findSessions, findSubjects } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), findSettings: vi.fn(), findUsers: vi.fn(), groupSessions: vi.fn(), countSessions: vi.fn(), findSessions: vi.fn(), findSubjects: vi.fn(),
}))
vi.mock('../src/lib/auth', () => ({ requireAdmin }))
vi.mock('../src/lib/db', () => ({ prisma: {
  userSettings: { findUnique: findSettings }, user: { findMany: findUsers },
  studySession: { groupBy: groupSessions, count: countSessions, findMany: findSessions },
  subject: { findMany: findSubjects },
} }))
import { publishedActivity } from '../src/lib/published-activity'

describe('admin published activity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requireAdmin.mockResolvedValue({ id: 'admin', role: 'admin' })
    findSettings.mockResolvedValue({ timezone: 'Africa/Casablanca' })
    findUsers.mockResolvedValue([{ id: 'a', username: 'alice', displayName: 'Alice', isActive: true, settings: { profileVisibility: 'public' } }, { id: 'b', username: 'bob', displayName: 'Bob', isActive: true, settings: { profileVisibility: 'public' } }])
    groupSessions.mockResolvedValue([{ ownerId: 'a', subjectId: 'subject-a', _sum: { durationSeconds: 3600 }, _count: { _all: 1 } }, { ownerId: 'b', subjectId: 'subject-b', _sum: { durationSeconds: 7200 }, _count: { _all: 1 } }])
    countSessions.mockResolvedValue(1)
    findSessions.mockResolvedValue([])
    findSubjects.mockResolvedValue([{ id: 'subject-a', ownerId: 'a', name: 'A', color: '#111111' }, { id: 'subject-b', ownerId: 'b', name: 'B', color: '#222222' }])
  })

  it('rejects non-admin access before any data query', async () => {
    requireAdmin.mockRejectedValue(new Error('Admin access required'))
    await expect(publishedActivity({})).rejects.toThrow('Admin access required')
    expect(findUsers).not.toHaveBeenCalled()
    expect(findSessions).not.toHaveBeenCalled()
  })

  it('requires published records in totals, filtered sessions, and weekly trends', async () => {
    const result = await publishedActivity({ username: 'ALICE' })
    expect(groupSessions.mock.calls[0][0].where).toEqual({ isPublic: true })
    expect(countSessions.mock.calls[0][0].where).toMatchObject({ isPublic: true, owner: { username: 'alice' } })
    expect(findSessions.mock.calls[0][0].where).toMatchObject({ isPublic: true, owner: { username: 'alice' } })
    expect(findSessions.mock.calls[1][0].where).toMatchObject({ isPublic: true })
    expect(result.totalSeconds).toBe(10800)
    expect(result.people.find(person => person.username === 'alice')?.seconds).toBe(3600)
    expect(result.people.find(person => person.username === 'bob')?.seconds).toBe(7200)
  })

  it('excludes malformed cross-owner subject associations from displayed totals', async () => {
    groupSessions.mockResolvedValue([{ ownerId: 'a', subjectId: 'subject-b', _sum: { durationSeconds: 1000 }, _count: { _all: 1 } }])
    const result = await publishedActivity({})
    expect(result.totalSeconds).toBe(0)
    expect(result.subjectTotals).toEqual([])
  })
})
