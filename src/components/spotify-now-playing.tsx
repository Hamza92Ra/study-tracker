'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Music2, RefreshCw } from 'lucide-react'
import { loadSpotifyNowPlaying } from '@/lib/spotify-account-actions'

type Playing = {
  kind: 'track' | 'episode'
  name: string
  artist: string
  artworkUrl: string | null
  spotifyUrl: string | null
  isPlaying: boolean
  progressMs: number
  durationMs: number
}
type State =
  | { status: 'loading' }
  | { status: 'idle' }
  | { status: 'playing'; item: Playing }
  | { status: 'error'; message: string; reconnect: boolean }

const REFRESH_INTERVAL_MS = 30_000
function timeLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

export function SpotifyNowPlaying() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [elapsed, setElapsed] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const requestRunning = useRef(false)

  const refresh = useCallback(async () => {
    if (requestRunning.current) return
    requestRunning.current = true
    setRefreshing(true)
    try {
      const result = await loadSpotifyNowPlaying()
      if (result.ok) {
        setState(result.playback ? { status: 'playing', item: result.playback } : { status: 'idle' })
        setElapsed(0)
      } else {
        setState({ status: 'error', message: result.error, reconnect: result.reconnect })
      }
    } catch {
      setState({ status: 'error', message: 'Could not check Spotify playback right now.', reconnect: false })
    } finally {
      requestRunning.current = false
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Spotify playback is not shared publicly. Poll only while this tab is visible.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    onVisible()
    const periodic = window.setInterval(onVisible, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(periodic)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (state.status !== 'playing' || !state.item.isPlaying) return
    const tick = window.setInterval(() => setElapsed(n => n + 1), 1000)
    return () => window.clearInterval(tick)
  }, [state])

  const item = state.status === 'playing' ? state.item : null
  const progress = item
    ? Math.min(item.durationMs, item.progressMs + (item.isPlaying ? elapsed * 1000 : 0))
    : 0
  const percent = item && item.durationMs > 0 ? Math.round(progress / item.durationMs * 100) : 0

  return (
    <div className="spotify-now-playing" aria-label="Spotify Now Playing">
      <div className="spotify-now-playing-head">
        <span className="spotify-playing-label">
          <Music2 size={16} aria-hidden="true" /> NOW PLAYING ON SPOTIFY
        </span>
        <button type="button" className="spotify-now-refresh" onClick={() => void refresh()}
          disabled={refreshing} aria-label="Refresh Spotify Now Playing" title="Refresh Spotify playback">
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>
      {item ? (
        <>
          <div className="spotify-now-track">
            <div className="spotify-now-art">
              {item.artworkUrl ? (
                // Display the approved Spotify CDN URL without relaying image data through our server.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.artworkUrl} alt="" referrerPolicy="no-referrer" />
              ) : <Music2 size={24} aria-hidden="true" />}
            </div>
            <div className="spotify-now-meta">
              <span className="spotify-now-status">
                <span className={'spotify-now-dot' + (item.isPlaying ? ' is-playing' : '')} />
                {item.isPlaying ? 'Playing' : 'Paused'}
              </span>
              <strong title={item.name}>{item.name}</strong>
              <small title={item.artist}>{item.artist || (item.kind === 'episode' ? 'Podcast episode' : 'Spotify')}</small>
            </div>
            {item.spotifyUrl && (
              <a className="spotify-now-open" href={item.spotifyUrl} target="_blank"
                rel="noopener noreferrer" aria-label="Open current song in Spotify">
                <ExternalLink size={17} aria-hidden="true" />
              </a>
            )}
          </div>
          {item.durationMs > 0 && (
            <div className="spotify-now-progress">
              <div className="spotify-now-trackline" role="progressbar" aria-label="Playback progress"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <span style={{ width: percent + '%' }} />
              </div>
              <div className="spotify-now-times"><span>{timeLabel(progress)}</span><span>{timeLabel(item.durationMs)}</span></div>
            </div>
          )}
        </>
      ) : (
        <p className="spotify-now-empty" role="status">
          {state.status === 'loading'
            ? 'Checking your Spotify playback…'
            : state.status === 'idle'
              ? 'Nothing playing on Spotify right now. Start a song in Spotify to see it here.'
              : state.status === 'error' ? state.message : ''}
          {state.status === 'error' && state.reconnect && (
            <> <a href="/api/spotify/connect">Reconnect Spotify</a> to grant playback access.</>
          )}
        </p>
      )}
      <p className="spotify-now-hint">Updates about every 30 seconds while this tab is open.</p>
    </div>
  )
}
