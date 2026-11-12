import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchLikedTrackBatch, createPrivateLikedPlaylist, writeLikedPlaylistBatch,
} from '../src/lib/spotify-liked-playlist-api'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Full Liked Songs playlist copy API', () => {
  const trackId = '11dFghVXANMlKmJXsNCbNl'

  it('loads complete pages of liked track URIs, skipping unavailable/local tracks', async () => {
    const fake = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        total: 73,
        next: 'https://api.spotify.com/v1/me/tracks?limit=50&offset=50',
        items: [
          {track:{id:trackId,is_local:false}},
          {track:{id:'bad',is_local:false}},
          {track:{id:trackId,is_local:true}},
          {track:null},
        ],
      }),
    })
    vi.stubGlobal('fetch',fake)
    expect(await fetchLikedTrackBatch('token',0)).toEqual({
      uris:['spotify:track:' + trackId], total:73, nextOffset:50,
    })
    expect(fake.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me/tracks?limit=50&offset=0')
  })

  it('reports end of saved tracks without silently inventing more pages', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({
        total:1,next:null,items:[{track:{id:trackId}}],
      }),
    }))
    expect(await fetchLikedTrackBatch('token',0)).toEqual({
      uris:['spotify:track:' + trackId],total:1,nextOffset:null,
    })
    await expect(fetchLikedTrackBatch('token',-50)).rejects.toThrow('Invalid Liked Songs')
    await expect(fetchLikedTrackBatch('token',51)).rejects.toThrow('Invalid Liked Songs')
  })

  it('creates a private playlist using the current Spotify endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:true,status:201,json:async()=>({id:trackId}),
    })
    vi.stubGlobal('fetch',mockFetch)
    expect(await createPrivateLikedPlaylist('token')).toBe(trackId)
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me/playlists')
    const init=mockFetch.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).public).toBe(false)
  })

  it('appends tracks to a playlist and can explicitly replace them for refresh', async () => {
    const mockFetch=vi.fn().mockResolvedValue({ok:true,status:201})
    vi.stubGlobal('fetch',mockFetch)
    const uris=['spotify:track:'+trackId]
    await writeLikedPlaylistBatch('token',trackId,uris)
    await writeLikedPlaylistBatch('token',trackId,uris,true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.spotify.com/v1/playlists/'+trackId+'/items')
    expect(mockFetch.mock.calls[0][1].method).toBe('POST')
    expect(mockFetch.mock.calls[1][1].method).toBe('PUT')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).uris).toEqual(uris)
    await expect(writeLikedPlaylistBatch('token','invalid!',uris)).rejects.toThrow('Invalid Spotify playlist batch')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('preserves progress on quota or missing permission errors', async () => {
    const mockFetch=vi.fn().mockResolvedValueOnce({ok:false,status:429})
      .mockResolvedValueOnce({ok:false,status:403})
    vi.stubGlobal('fetch',mockFetch)
    await expect(fetchLikedTrackBatch('token',0)).rejects.toThrow('Resume the import later')
    await expect(createPrivateLikedPlaylist('token')).rejects.toThrow('Reconnect Spotify')
  })
})
