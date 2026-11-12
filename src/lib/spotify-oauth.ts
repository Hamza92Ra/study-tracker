import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto'
import { z } from 'zod'

export const SPOTIFY_SCOPES = 'user-read-private playlist-read-private user-library-read user-read-currently-playing playlist-modify-private'

const authPayload = z.object({
  ownerId: z.string().min(1).max(128),
  state: z.string().min(24).max(128),
  verifier: z.string().min(43).max(128),
  expiresAt: z.number().int(),
})

function secret() {
  const value = process.env.NEXTAUTH_SECRET
  if (!value || value.length < 32) throw new Error('Server authentication secret not configured')
  return value
}

export function spotifyClientId() {
  const id = process.env.SPOTIFY_CLIENT_ID?.trim()
  return id && id.length >= 10 && id.length <= 128 ? id : null
}

export function spotifyCallbackUrl() {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1') {
    throw new Error('Spotify OAuth requires HTTPS')
  }
  return new URL('/api/spotify/callback', origin).toString()
}

function signingKey() {
  return createHash('sha256').update('study-ledger:spotify:oauth-cookie:v1:').update(secret()).digest()
}

function encryptionKey() {
  return createHash('sha256').update('study-ledger:spotify:token-encryption:v1:').update(secret()).digest()
}

// Application-specific authenticated-cookie state prevents OAuth login CSRF, tampering
// and cross-account callback substitution, including during password/session revocation.
export function createSpotifyAuthState(ownerId: string, timestamp = Date.now()) {
  const state = randomBytes(24).toString('base64url')
  const verifier = randomBytes(64).toString('base64url')
  const payload = { ownerId, state, verifier, expiresAt: timestamp + 10 * 60_000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', signingKey()).update(encoded).digest('base64url')
  return { state, verifier, cookie: encoded + '.' + signature }
}

export function verifySpotifyAuthState(cookie: string | undefined, state: string | null, ownerId: string, timestamp = Date.now()) {
  if (!cookie || !state || cookie.length > 2048) return null
  const [encoded, supplied, extra] = cookie.split('.')
  if (!encoded || !supplied || extra) return null
  const signature = createHmac('sha256', signingKey()).update(encoded).digest()
  let given: Buffer
  try { given = Buffer.from(supplied, 'base64url') } catch { return null }
  if (signature.length !== given.length || !timingSafeEqual(signature, given)) return null
  try {
    const parsed = authPayload.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')))
    const expectedState = Buffer.from(parsed.state, 'utf8')
    const suppliedState = Buffer.from(state, 'utf8')
    if (expectedState.length !== suppliedState.length || !timingSafeEqual(expectedState, suppliedState)) return null
    if (parsed.ownerId !== ownerId || parsed.expiresAt < timestamp || parsed.expiresAt > timestamp + 600_000) return null
    return parsed
  } catch { return null }
}

export function spotifyCodeChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function spotifyAuthorizationUrl(clientId: string, state: string, challenge: string, redirectUri: string) {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({
    response_type: 'code', client_id: clientId, scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri, state, code_challenge_method: 'S256', code_challenge: challenge,
  }).toString()
  return url.toString()
}

export function encryptSpotifyToken(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptSpotifyToken(value: string) {
  const [iv, tag, encrypted, extra] = value.split('.')
  if (!iv || !tag || !encrypted || extra) throw new Error('Invalid encrypted token')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  token_type: z.string(),
})

export type SpotifyTokenResponse = z.infer<typeof tokenSchema>

export async function requestSpotifyToken(body: URLSearchParams): Promise<SpotifyTokenResponse> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('Spotify authorization failed. Please reconnect your account.')
  const payload = await response.json()
  const token = tokenSchema.parse(payload)
  if (token.token_type.toLowerCase() !== 'bearer') throw new Error('Unexpected Spotify token type')
  return token
}

const profileSchema = z.object({
  account_id: z.string().min(1).max(255),
  display_name: z.string().nullable().optional(),
  id: z.string().optional(),
  images: z.array(z.object({ url: z.string() }).passthrough()).optional(),
  external_urls: z.object({ spotify: z.string().optional() }).optional(),
})

export async function fetchSpotifyProfile(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: 'Bearer ' + accessToken },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('Could not retrieve your Spotify profile')
  const user = profileSchema.parse(await response.json())
  const image = user.images?.find(item => validHttpsUrl(item.url, ['i.scdn.co', 'mosaic.scdn.co']))
  const profileLink = user.external_urls?.spotify
  return {
    spotifyAccountId: user.account_id,
    displayName: (user.display_name || 'Spotify listener').slice(0, 128),
    avatarUrl: image?.url.slice(0, 500) || null,
    profileUrl: profileLink && validHttpsUrl(profileLink, ['open.spotify.com']) ? profileLink.slice(0, 500) : null,
  }
}

function validHttpsUrl(raw: string, hosts: string[]) {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password && !url.port && raw.length <= 500
  } catch { return false }
}

const playlistSchema = z.object({
  items: z.array(z.object({
    id: z.string().nullable(),
    name: z.string(),
    external_urls: z.object({ spotify: z.string().optional() }).optional(),
  }).passthrough()).max(50),
})

export async function fetchSpotifyPlaylists(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
    headers: { Authorization: 'Bearer ' + accessToken },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('Could not load your Spotify playlists. Reconnect your account if needed.')
  const result = playlistSchema.parse(await response.json())
  return result.items.filter(p => p.id && /^[A-Za-z0-9]{22}$/.test(p.id)).map(p => ({
    id: p.id!, name: p.name.slice(0, 80), url: 'https://open.spotify.com/playlist/' + p.id,
  }))
}


// Spotify's Liked Songs library is NOT itself an embeddable playlist.
// Users can browse their saved tracks and add individual tracks to Study Ledger.
const savedTrackSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  artists: z.array(z.object({ name: z.string() })).optional(),
})
const savedTracksPageSchema = z.object({
  items: z.array(z.object({ track: savedTrackSchema.nullable().optional() })).max(50),
  total: z.number().int().nonnegative().optional(),
  next: z.string().nullable().optional(),
})

export async function fetchSpotifyLikedSongs(accessToken: string, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) {
    throw new Error('Invalid Liked Songs page')
  }
  const limit = 20
  const requestUrl = new URL('https://api.spotify.com/v1/me/tracks')
  requestUrl.searchParams.set('limit', String(limit))
  requestUrl.searchParams.set('offset', String(offset))
  const response = await fetch(requestUrl.toString(), {
    headers: { Authorization: 'Bearer ' + accessToken },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('Reconnect Spotify to grant access to your Liked Songs.')
  }
  if (!response.ok) throw new Error('Could not load your Liked Songs. Please try again.')
  const page = savedTracksPageSchema.parse(await response.json())
  const tracks = page.items.flatMap(({ track }) => {
    if (!track?.id || !/^[A-Za-z0-9]{22}$/.test(track.id)) return []
    const artist = (track.artists ?? []).map(a => a.name).join(', ').slice(0, 100)
    return [{
      id: track.id,
      name: track.name.slice(0, 160),
      artist,
      url: 'https://open.spotify.com/track/' + track.id,
    }]
  })
  const nextOffset = (page.next !== null && page.next !== undefined)
    ? offset + limit
    : (page.total !== undefined && offset + limit < page.total ? offset + limit : null)
  return { tracks, nextOffset: nextOffset !== null && nextOffset <= 10000 ? nextOffset : null }
}


// Read-only playback metadata, never a playback controller or audio proxy.
const nowPlayingItemSchema = z.object({
  type: z.string().optional(),
  name: z.string(),
  duration_ms: z.number().int().nonnegative().optional(),
  external_urls: z.object({ spotify: z.string().optional() }).optional(),
  artists: z.array(z.object({ name: z.string() })).optional(),
  show: z.object({ name: z.string() }).optional(),
  album: z.object({
    images: z.array(z.object({ url: z.string() })).optional(),
  }).optional(),
  images: z.array(z.object({ url: z.string() })).optional(),
})
const nowPlayingResponseSchema = z.object({
  is_playing: z.boolean(),
  progress_ms: z.number().int().nonnegative().nullable().optional(),
  currently_playing_type: z.string().optional(),
  item: nowPlayingItemSchema.nullable().optional(),
})

export async function fetchSpotifyNowPlaying(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: 'Bearer ' + accessToken },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 204) return null
  if (response.status === 401 || response.status === 403) {
    throw new Error('Reconnect Spotify to allow Now Playing access.')
  }
  if (response.status === 429) {
    throw new Error('Spotify is temporarily limiting playback updates. Try again shortly.')
  }
  if (!response.ok) throw new Error('Could not read playback from Spotify.')
  const state = nowPlayingResponseSchema.parse(await response.json())
  const item = state.item
  if (!item || !['track', 'episode'].includes(item.type || '') ||
    state.currently_playing_type === 'ad') return null
  const images = item.type === 'episode' ? item.images : item.album?.images
  const image = images?.find(i => validHttpsUrl(i.url, ['i.scdn.co', 'mosaic.scdn.co']))
  const link = item.external_urls?.spotify
  return {
    kind: item.type as 'track' | 'episode',
    name: item.name.slice(0, 160),
    artist: (item.artists?.map(a => a.name).join(', ') || item.show?.name || '').slice(0, 160),
    artworkUrl: image?.url.slice(0, 500) ?? null,
    spotifyUrl: link && validHttpsUrl(link, ['open.spotify.com']) ? link.slice(0, 500) : null,
    isPlaying: state.is_playing,
    progressMs: Math.max(0, state.progress_ms ?? 0),
    durationMs: Math.max(0, item.duration_ms ?? 0),
  }
}
