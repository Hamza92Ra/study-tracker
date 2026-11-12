import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ owner: vi.fn(), findFirst: vi.fn(), settings: vi.fn(), revalidate: vi.fn() }))
vi.mock('../src/lib/auth', () => ({ requireOwner: mock.owner }))
vi.mock('../src/lib/db', () => ({ prisma: { spotifyLink: { findFirst: mock.findFirst }, userSettings: { upsert: mock.settings } } }))
vi.mock('next/cache', () => ({ revalidatePath: mock.revalidate }))
import { selectSpotifyLink } from '../src/lib/spotify-actions'
beforeEach(() => { vi.clearAllMocks(); mock.owner.mockResolvedValue({ id: 'owner-a' }) })
describe('Spotify ownership', () => {
  it('refuses to select another user’s saved link', async () => {
    mock.findFirst.mockResolvedValue(null)
    expect(await selectSpotifyLink('someone-elses-link')).toEqual({ ok: false, error: 'Playlist not found.' })
    expect(mock.findFirst).toHaveBeenCalledWith({ where: { id: 'someone-elses-link', ownerId: 'owner-a' }, select: { id: true } })
    expect(mock.settings).not.toHaveBeenCalled()
  })
  it('saves only a link owned by the signed-in account', async () => {
    mock.findFirst.mockResolvedValue({ id: 'own-link' })
    mock.settings.mockResolvedValue({})
    expect(await selectSpotifyLink('own-link')).toEqual({ ok: true })
    expect(mock.settings).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'owner-a' }, update: { selectedSpotifyLinkId: 'own-link' } }))
  })
})
