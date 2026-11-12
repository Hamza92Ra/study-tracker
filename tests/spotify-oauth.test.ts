import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSpotifyAuthState, decryptSpotifyToken, encryptSpotifyToken,
  fetchSpotifyProfile, fetchSpotifyPlaylists, requestSpotifyToken,
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
