import { describe, expect, it } from 'vitest'
import { parseSpotifyUrl } from '../src/lib/spotify'
const id = '37i9dQZF1DXcBWIGoYBM5M'
describe('Spotify URLs', () => {
  it('normalizes official playlist and album links for safe embedding', () => {
    expect(parseSpotifyUrl(`https://open.spotify.com/playlist/${id}?si=tracking`)).toEqual({ kind: 'playlist', id, url: `https://open.spotify.com/playlist/${id}`, embedUrl: `https://open.spotify.com/embed/playlist/${id}` })
    expect(parseSpotifyUrl(`https://open.spotify.com/embed/album/${id}`).kind).toBe('album')
    expect(parseSpotifyUrl(`https://open.spotify.com/track/${id}`)).toEqual({ kind: 'track', id, url: `https://open.spotify.com/track/${id}`, embedUrl: `https://open.spotify.com/embed/track/${id}` })
  })
  it.each([
    `http://open.spotify.com/playlist/${id}`,
    `https://open.spotify.com.evil.test/playlist/${id}`,
    `https://user@open.spotify.com/playlist/${id}`,
    `https://open.spotify.com/playlist/${id}/extra`,
    'javascript:alert(1)',
  ])('rejects unsafe or unsupported input: %s', url => {
    expect(() => parseSpotifyUrl(url)).toThrow()
  })
})
