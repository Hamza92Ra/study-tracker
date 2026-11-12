import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ findUnique: vi.fn(), findFirst: vi.fn(), subjects: vi.fn(), sessions: vi.fn(), count: vi.fn(), groupBy: vi.fn() }))
vi.mock('../src/lib/db', () => ({ prisma: { user: { findUnique: mock.findUnique, findFirst: mock.findFirst }, subject: { findMany: mock.subjects }, studySession: { findMany: mock.sessions, count: mock.count, groupBy: mock.groupBy } } }))
import { activityPage, publicOwner, publicSummary, publicSubjectDistribution } from '../src/lib/data'
const owner = { id: 'owner-a', username: 'alice', role: 'member', isActive: true, settings: { profileVisibility: 'public', timezone: 'UTC' } }
beforeEach(() => { vi.clearAllMocks() })
describe('public profile isolation', () => {
  it('hides private and suspended profiles', async () => {
    mock.findUnique.mockResolvedValueOnce({ ...owner, settings: { profileVisibility: 'private' } }).mockResolvedValueOnce({ ...owner, isActive: false })
    expect(await publicOwner('alice')).toBeNull()
    expect(await publicOwner('alice')).toBeNull()
  })
  it('scopes summary to the selected owner and published sessions', async () => {
    mock.findUnique.mockResolvedValue(owner)
    mock.subjects.mockResolvedValue([])
    mock.sessions.mockResolvedValue([])
    const result = await publicSummary('alice')
    expect(result?.owner.id).toBe(owner.id)
    expect(mock.sessions).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: owner.id, isPublic: true, subject: { ownerId: owner.id } } }))
    expect(mock.subjects).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: owner.id } }))
  })
  it('scopes history filters and pagination to the same owner', async () => {
    mock.count.mockResolvedValue(0)
    mock.sessions.mockResolvedValue([])
    await activityPage(owner.id, 'UTC', { subject: 'math', search: 'review', page: 2, pageSize: 10 })
    const query = mock.sessions.mock.calls[0][0]
    expect(query.where).toMatchObject({ ownerId: owner.id, isPublic: true, subject: { ownerId: owner.id, slug: 'math' }, title: { contains: 'review' } })
    expect(query.skip).toBe(10)
    expect(query.take).toBe(10)
  })
  it('aggregates subjects without reading private sessions or other accounts', async () => {
    mock.findUnique.mockResolvedValue(owner)
    mock.subjects.mockResolvedValue([{ id: 'subject-a', ownerId: owner.id, isArchived: false }])
    mock.groupBy.mockResolvedValue([{ subjectId: 'subject-a', _sum: { durationSeconds: 3600 }, _count: { _all: 1 } }])
    const result = await publicSubjectDistribution('alice')
    expect(result?.distribution[0]).toMatchObject({ seconds: 3600, count: 1, percent: 100 })
    expect(mock.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: owner.id, isPublic: true, subject: { ownerId: owner.id } } }))
  })
})
