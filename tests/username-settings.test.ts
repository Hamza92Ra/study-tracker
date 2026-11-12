import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
const mock = vi.hoisted(() => ({ requireOwner: vi.fn(), update: vi.fn(), settings: vi.fn(), goal: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }))
vi.mock('../src/lib/auth', () => ({ requireOwner: mock.requireOwner }))
vi.mock('../src/lib/db', () => ({ prisma: { user: { update: mock.update }, userSettings: { upsert: mock.settings }, studyGoal: { upsert: mock.goal }, $transaction: mock.transaction } }))
vi.mock('next/cache', () => ({ revalidatePath: mock.revalidate }))
import { saveSettings } from '../src/lib/actions'
const input = { username: '  NEW_NAME  ', displayName: 'Owner', biography: '', studyGoal: '', avatarUrl: '', timezone: 'UTC', dailyTargetMinutes: 180, profileVisibility: 'public', themePreference: 'system' }
beforeEach(() => { vi.clearAllMocks(); mock.requireOwner.mockResolvedValue({ id: 'owner-a', username: 'old_name' }); mock.update.mockResolvedValue({}); mock.settings.mockResolvedValue({}); mock.goal.mockResolvedValue({}); mock.transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)) })
describe('username settings', () => {
  it('normalizes and changes only the signed-in owner account', async () => {
    expect(await saveSettings({ ...input, ownerId: 'another-user', id: 'another-user' })).toMatchObject({ ok: true, username: 'new_name' })
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'owner-a' }, data: expect.objectContaining({ username: 'new_name' }) }))
  })
  it('returns a friendly error when a username is already taken', async () => {
    mock.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.19.3' }))
    expect(await saveSettings(input)).toEqual({ ok: false, error: 'That username is already taken.' })
  })
  it('rejects invalid names before writing', async () => {
    expect((await saveSettings({ ...input, username: '../admin' })).ok).toBe(false)
    expect(mock.update).not.toHaveBeenCalled()
  })
})
