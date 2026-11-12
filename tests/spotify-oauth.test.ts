import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSpotifyAuthState, decryptSpotifyToken, encryptSpotifyToken,
  fetchSpotifyProfile, fetchSpotifyPlaylists, fetchSpotifyLikedSongs, fetchSpotifyNowPlaying, requestSpotifyToken,
  spotifyAuthorizationUrl, spotifyCallbackUrl, spotifyCodeChallenge,
  verifySpotifyAuthState,
} from '../src/lib/spotify-oauth'

const currentSecret = process.env.NEXTAUTH_SECRET
const currentSite = process.env.NEXT_PUBLIC_SITE_URL

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'CI_ONLY_unique_spotify_oauth_secret_at_least_32_chars'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://study-tracker-delta-three.vercel.app'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (currentSecret === undefined) delete process.env.NEXTAUTH_SECRET
  else process.env.NEXTAUTH_SECRET = currentSecret
  if (currentSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = currentSite
})

describe('Spotify OAuth PKCE and signed state', () => {
  it('builds a safe authorize request with the required minimum scopes', () => {
    const challenge = spotifyCodeChallenge('x'.repeat(64))
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const url = new URL(spotifyAuthorizationUrl('some-client-id', 'opaque-state', challenge, spotifyCallbackUrl()))
    expect(url.origin).toBe('https://accounts.spotify.com')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('client_id')).toBe('some-client-id')
    expect(url.searchParams.get('scope')).toContain('user-read-private')
    expect(url.searchParams.get('scope')).toContain('playlist-read-private')
    expect(url.searchParams.get('scope')).toContain('user-library-read')
    expect(url.searchParams.get('scope')).toContain('user-read-currently-playing')
    expect(url.searchParams.get('redirect_uri')).toBe('https://study-tracker-delta-three.vercel.app/api/spotify/callback')
  })
  it('allows only the same user with the correct state inside its 10 minute lifetime', () => {
    const timestamp = 1794400000000
    const auth = createSpotifyAuthState('owner-one', timestamp)
    const good = verifySpotifyAuthState(auth.cookie, auth.state, 'owner-one', timestamp + 1000)
    expect(good?.verifier).toBe(auth.verifier)
    expect(verifySpotifyAuthState(auth.cookie, auth.state, 'owner-two', timestamp)).toBeNull()
    expect(verifySpotifyAuthState(auth.cookie, 'wrong-state', 'owner-one', timestamp)).toBeNull()
    expect(verifySpotifyAuthState(auth.cookie, auth.state, 'owner-one', timestamp + 601000)).toBeNull()
  })
  it('rejects tampered and unsigned OAuth state cookies', () => {
    const auth = createSpotifyAuthState('owner', 1794400000000)
    const [payload, mac] = auth.cookie.split('.')
    const invalidPayload = Buffer.from(JSON.stringify({ ownerId: 'attacker' })).toString('base64url')
    expect(verifySpotifyAuthState(invalidPayload + '.' + mac, auth.state, 'owner', 1794400000001)).toBeNull()
    expect(verifySpotifyAuthState(payload + '.fake', auth.state, 'owner', 1794400000001)).toBeNull()
    expect(verifySpotifyAuthState(undefined, auth.state, 'owner', 1794400000001)).toBeNull()
  })
  it('encrypts tokens at rest and rejects modified ciphertext', () => {
    const stored = encryptSpotifyToken('token-visible-only-to-spotify')
    expect(stored).not.toContain('token-visible')
    expect(decryptSpotifyToken(stored)).toBe('token-visible-only-to-spotify')
    const parts = stored.split('.')
    expect(() => decryptSpotifyToken(parts[0] + '.' + parts[1] + '.fake')).toThrow()
  })
})

describe('Spotify API response constraints', () => {
  it('rejects a non-Spotify identity and accepts a stable account_id', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true, json: async () => ({
        account_id: 'stable-unique-id', display_name: ' My Name ',
        images: [{url: 'https://i.scdn.co/image/abc'}],
        external_urls: {spotify: 'https://open.spotify.com/user/example'},
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const profile = await fetchSpotifyProfile('opaque-access-token')
    expect(profile).toEqual({
      spotifyAccountId: 'stable-unique-id', displayName: ' My Name ',
      avatarUrl: 'https://i.scdn.co/image/abc',
      profileUrl: 'https://open.spotify.com/user/example',
    })
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer opaque-access-token')
  })
  it('only returns valid playlists and never accepts an arbitrary embedded URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({items: [
        {id: '37i9dQZF1DXcBWIGoYBM5M',name: 'Focus'},
        {id: 'invalid!',name:'Unknown'},
        {id: null,name:'Missing'},
      ]}),
    }))
    expect(await fetchSpotifyPlaylists('opaque')).toEqual([
      {id:'37i9dQZF1DXcBWIGoYBM5M',name:'Focus',url:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'}
    ])
  })
  it('exchanges only a valid Spotify Bearer token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({access_token:'encrypted-later',refresh_token:'refresh-me',expires_in:3600,token_type:'Bearer'}),
    }))
    expect(await requestSpotifyToken(new URLSearchParams({grant_type:'authorization_code'}))).toEqual({
      access_token:'encrypted-later',refresh_token:'refresh-me',expires_in:3600,token_type:'Bearer',
    })
  })
})

describe('Liked Songs library', () => {
  it('requests saved tracks with the allowed scope and returns playable track IDs', async () => {
    const validId = '11dFghVXANMlKmJXsNCbNl'
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { track: { id: validId, name: 'Song', artists: [{ name: 'Artist' }] } },
          { track: { id: 'bad-id', name: 'Invalid', artists: [] } },
          { track: null },
        ],
        total: 21,
        next: 'https://api.spotify.com/v1/me/tracks?limit=20&offset=20',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)
    expect(await fetchSpotifyLikedSongs('secret-token', 0)).toEqual({
      tracks: [{ id: validId, name: 'Song', artist: 'Artist', url: 'https://open.spotify.com/track/' + validId }],
      nextOffset: 20,
    })
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me/tracks?limit=20&offset=0')
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-token')
  })
  it('says to reconnect if existing token is missing the library scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(fetchSpotifyLikedSongs('old-token', 0)).rejects.toThrow('Reconnect Spotify')
  })
  it('rejects unsafe pagination values', async () => {
    await expect(fetchSpotifyLikedSongs('token', -20)).rejects.toThrow('Invalid Liked Songs page')
  })
})


describe('Now Playing status', () => {
  it('returns an empty status if Spotify reports 204 No Content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))
    expect(await fetchSpotifyNowPlaying('spotify-access')).toBeNull()
  })
  it('returns only safe track data and the current playback position', async () => {
    const fake = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        is_playing: true, progress_ms: 95000, currently_playing_type: 'track',
        item: {
          type: 'track', name: 'Study Session', duration_ms: 240000,
          artists: [{ name: 'Example Artist' }],
          external_urls: { spotify: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl' },
          album: { images: [{ url: 'https://i.scdn.co/image/example' }] },
        },
      }),
    })
    vi.stubGlobal('fetch', fake)
    expect(await fetchSpotifyNowPlaying('spotify-access')).toEqual({
      kind: 'track', name: 'Study Session', artist: 'Example Artist', isPlaying: true,
      artworkUrl: 'https://i.scdn.co/image/example',
      spotifyUrl: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
      progressMs: 95000, durationMs: 240000,
    })
    expect(fake).toHaveBeenCalledWith('https://api.spotify.com/v1/me/player/currently-playing',
      expect.objectContaining({ cache: 'no-store', headers: { Authorization: 'Bearer spotify-access' } }))
  })
  it('handles paused tracks, ads, and missing content correctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({
        is_playing: false, progress_ms: 100, currently_playing_type: 'track',
        item: { type: 'track', name: 'Paused', duration_ms: 5000, artists: [] },
      }),
    }).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ is_playing: true, currently_playing_type: 'ad', item: null }),
    }))
    expect((await fetchSpotifyNowPlaying('spotify-access'))?.isPlaying).toBe(false)
    expect(await fetchSpotifyNowPlaying('spotify-access')).toBeNull()
  })
  it('asks users with old permissions to reconnect and handles rate limiting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: false, status: 429 }))
    await expect(fetchSpotifyNowPlaying('old-token')).rejects.toThrow('Reconnect Spotify')
    await expect(fetchSpotifyNowPlaying('old-token')).rejects.toThrow('limiting playback updates')
  })
})
