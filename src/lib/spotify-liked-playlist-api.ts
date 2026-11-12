import { z } from 'zod'

const playlistId = /^[A-Za-z0-9]{22}$/
const pageSchema = z.object({
  total: z.number().int().nonnegative(),
  next: z.string().nullable(),
  items: z.array(z.object({
    track: z.object({
      id: z.string().nullable().optional(),
      is_local: z.boolean().optional(),
    }).nullable().optional(),
  })).max(50),
})

function checkResponse(response: Response, action: string) {
  if (response.status === 401 || response.status === 403) {
    throw new Error('Reconnect Spotify to grant permission to create private playlists and read Liked Songs.')
  }
  if (response.status === 429) {
    throw new Error('Spotify is limiting requests. Resume the import later; your progress is saved.')
  }
  if (!response.ok) throw new Error('Spotify could not ' + action + '. Resume the import later.')
}

export type SavedTrackBatch = { uris: string[]; total: number; nextOffset: number | null }

export async function fetchLikedTrackBatch(token: string, offset: number): Promise<SavedTrackBatch> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset % 50 !== 0 || offset > 250000) {
    throw new Error('Invalid Liked Songs import position.')
  }
  const url = new URL('https://api.spotify.com/v1/me/tracks')
  url.searchParams.set('limit', '50')
  url.searchParams.set('offset', String(offset))
  const response = await fetch(url.toString(), {
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  checkResponse(response, 'load Liked Songs')
  const page = pageSchema.parse(await response.json())
  const uris = page.items.flatMap(({ track }) =>
    track && !track.is_local && track.id && playlistId.test(track.id)
      ? ['spotify:track:' + track.id] : [],
  )
  const nextOffset = page.next && page.items.length
    ? offset + 50 : null
  return { uris, total: page.total, nextOffset }
}

const createdPlaylistSchema = z.object({ id: z.string().regex(playlistId) })

export async function createPrivateLikedPlaylist(token: string): Promise<string> {
  const response = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Study Ledger — Liked Songs',
      description: 'My Liked Songs copied into a playlist for studying. Created by Study Ledger.',
      public: false,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  checkResponse(response, 'create the private Liked Songs playlist')
  return createdPlaylistSchema.parse(await response.json()).id
}

export async function writeLikedPlaylistBatch(
  token: string, id: string, uris: string[], replace = false,
): Promise<void> {
  if (!playlistId.test(id) || uris.length > 100 ||
    uris.some(uri => !/^spotify:track:[A-Za-z0-9]{22}$/.test(uri))) {
    throw new Error('Invalid Spotify playlist batch.')
  }
  const response = await fetch('https://api.spotify.com/v1/playlists/' + id + '/items', {
    method: replace ? 'PUT' : 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  checkResponse(response, replace ? 'refresh your playlist' : 'add songs to your playlist')
}
