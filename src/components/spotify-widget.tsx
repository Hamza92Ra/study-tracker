'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Music2, Plus, Trash2, Eye, EyeOff, Link2, ExternalLink, RefreshCcw, Unplug, ChevronDown, ChevronUp, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { SpotifyNowPlaying } from '@/components/spotify-now-playing'
import { addSpotifyLink, removeSpotifyLink, selectSpotifyLink, setSpotifyVisible } from '@/lib/spotify-actions'
import {
  disconnectSpotifyAccount,
  loadSpotifyAccountPlaylists,
  loadSpotifyLikedSongs,
} from '@/lib/spotify-account-actions'

type SavedLink = { id: string; kind: string; spotifyId: string; label: string }
type Profile = { displayName: string; avatarUrl: string | null; profileUrl: string | null }
type Playlist = { id: string; name: string; url: string }
type LikedTrack = { id: string; name: string; artist: string; url: string }

const noticeMessages: Record<string, string> = {
  connected: 'Spotify account connected successfully.',
  cancelled: 'Spotify connection was cancelled.',
  invalid_state: 'Connection expired. Please try again.',
  invalid_code: 'Spotify did not return a valid authorization code.',
  missing_refresh_token: 'Spotify did not provide access for a lasting connection.',
  not_configured: 'The Spotify connection has not been configured by the site administrator.',
  connection_failed: 'Spotify connection failed. Please try again.',
  already_linked: 'That Spotify account is already linked to another Study Ledger user.',
  session: 'Your Study Ledger session expired. Please sign in again.',
}

export function SpotifyWidget({
  links, selectedId, visible, account, accountConnectEnabled, connectionNotice, workspaceId,
}: {
  links: SavedLink[]
  selectedId: string | null
  visible: boolean
  account: Profile | null
  accountConnectEnabled: boolean
  connectionNotice?: string
  workspaceId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [myPlaylists, setMyPlaylists] = useState<Playlist[] | null>(null)
  const [likedSongs, setLikedSongs] = useState<LikedTrack[] | null>(null)
  const [likedNextOffset, setLikedNextOffset] = useState<number | null>(null)
  const [playlistError, setPlaylistError] = useState('')
  const [likedError, setLikedError] = useState('')
  const [accountCollapsed, setAccountCollapsed] = useState(false)
  const selected = links.find(link => link.id === selectedId) ?? links[0]

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('study-ledger-spotify-details-' + workspaceId)
      // Restore this workspace's choice after client hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccountCollapsed(stored === 'collapsed')
    } catch {
      // Storage may be disabled; the button still works for this visit.
    }
  }, [workspaceId])

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string,
  ) {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) toast.error(result.error)
        else {
          toast.success(success)
          router.refresh()
        }
      } catch {
        toast.error('Spotify request failed. Please try again.')
      }
    })
  }

  function loadPlaylists() {
    setPlaylistError('')
    startTransition(async () => {
      try {
        const result = await loadSpotifyAccountPlaylists()
        if (!result.ok) setPlaylistError(result.error)
        else setMyPlaylists(result.playlists)
      } catch {
        setPlaylistError('Could not contact Spotify. Please try again.')
      }
    })
  }

  function loadLikedSongs(offset = 0) {
    setLikedError('')
    startTransition(async () => {
      try {
        const result = await loadSpotifyLikedSongs(offset)
        if (!result.ok) {
          setLikedError(result.error)
        } else {
          setLikedSongs(previous => offset === 0 ? result.tracks :
            [...(previous ?? []), ...result.tracks.filter(track => !previous?.some(item => item.id === track.id))])
          setLikedNextOffset(result.nextOffset)
        }
      } catch {
        setLikedError('Could not load your Liked Songs. Please try again.')
      }
    })
  }

  function disconnect() {
    if (!window.confirm('Disconnect your Spotify account? Your saved playlist and track embeds will remain available.')) return
    setMyPlaylists(null)
    setLikedSongs(null)
    run(disconnectSpotifyAccount, 'Spotify disconnected')
  }

  // Keep the library panel independent from the player. This deliberately uses
  // a user-scoped key so switching Study Ledger accounts won't mix preferences.
  function toggleAccount() {
    const next = !accountCollapsed
    setAccountCollapsed(next)
    try {
      window.localStorage.setItem('study-ledger-spotify-details-' + workspaceId, next ? 'collapsed' : 'expanded')
    } catch {
      // Storage may be unavailable in private-browsing mode.
    }
  }

  return (
    <section className="card manage-card spotify-widget" aria-label="Spotify study music">
      <div className="panel-head spotify-head">
        <div>
          <span className="eyebrow">FOCUS SOUNDTRACK</span>
          <h3><Music2 size={18} aria-hidden="true" /> Spotify study music</h3>
          <p className="panel-sub">Connect your account or keep using playlist and track links</p>
        </div>
        <button
          type="button" className="button button-secondary"
          aria-label={visible ? 'Hide Spotify player' : 'Show Spotify player'}
          onClick={() => run(() => setSpotifyVisible(!visible), visible ? 'Player hidden' : 'Player shown')}
          disabled={pending}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{visible ? 'Hide player' : 'Show player'}</span>
        </button>
      </div>

      {connectionNotice && noticeMessages[connectionNotice] && (
        <p className="spotify-connection-notice" role="status">{noticeMessages[connectionNotice]}</p>
      )}

      {account && <SpotifyNowPlaying />}

      <div className="spotify-account-panel">
        {account ? (
          <>
            <div className="spotify-account-top">
              <div className="spotify-account-identity">
                <div className="spotify-account-avatar">
                  {account.avatarUrl ? (
                    // Image source comes from Spotify's authenticated profile endpoint.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : <Music2 size={24} />}
                </div>
                <div className="spotify-account-text">
                  <span className="spotify-connection-label">Connected Spotify account</span>
                  <strong>{account.displayName}</strong>
                </div>
              </div>
              <button
                className="button button-secondary spotify-details-button" type="button"
                aria-expanded={!accountCollapsed} aria-controls="spotify-account-details"
                onClick={toggleAccount}
              >
                {accountCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                {accountCollapsed ? 'Show details' : 'Hide details'}
              </button>
            </div>
            {!accountCollapsed && (
              <div id="spotify-account-details">
                {account.profileUrl && (
                  <a className="spotify-profile-link" href={account.profileUrl} target="_blank" rel="noopener noreferrer">
                    Open Spotify profile <ExternalLink size={13} />
                  </a>
                )}
                <div className="spotify-account-actions">
                  <button className="button button-secondary" type="button" disabled={pending} onClick={loadPlaylists}>
                    <RefreshCcw size={16} /> Load my playlists
                  </button>
                  <button className="button button-secondary" type="button" disabled={pending} onClick={() => loadLikedSongs(0)}>
                    <Heart size={16} /> Load Liked Songs
                  </button>
                  <button className="button button-ghost" type="button" disabled={pending} onClick={disconnect}>
                    <Unplug size={16} /> Disconnect
                  </button>
                </div>
                {playlistError && <p className="form-error" role="alert">{playlistError}</p>}
                <div className="spotify-library" aria-label="Your Spotify playlists and Liked Songs">
                  <strong>Your Spotify library</strong>
                  <ul>
                    <li className="spotify-liked-library-entry">
                      <span className="spotify-liked-library-title">
                        <Heart size={18} aria-hidden="true" />
                        <span>
                          <strong>Liked Songs</strong>
                          <small>Saved tracks from your Spotify account</small>
                        </span>
                      </span>
                      <button className="button button-secondary" type="button" disabled={pending}
                        aria-label="Browse Liked Songs" onClick={() => loadLikedSongs(0)}>
                        Browse songs
                      </button>
                    </li>
                    {myPlaylists?.map(playlist => (
                      <li key={playlist.id}>
                        <span>{playlist.name}</span>
                        <button className="button button-secondary" type="button" disabled={pending}
                          onClick={() => run(() => addSpotifyLink({ url: playlist.url, label: playlist.name }), 'Playlist saved to your study player')}>
                          <Plus size={14} /> Add
                        </button>
                      </li>
                    ))}
                  </ul>
                  {myPlaylists === null ? (
                    <p className="panel-sub">Click Load my playlists to see your other playlists.</p>
                  ) : myPlaylists.length === 0 ? (
                    <p className="panel-sub">No other playlists found in the first 20 results.</p>
                  ) : (
                    <p className="panel-sub">Imported playlists are saved in your private Study Ledger workspace.</p>
                  )}
                </div>
                {likedError && (
                  <div className="spotify-library" role="alert">
                    <p className="form-error">{likedError}</p>
                    {likedError.includes('Reconnect Spotify') && (
                      <a className="button button-secondary" href="/api/spotify/connect">
                        <Link2 size={14} /> Reconnect Spotify for Liked Songs
                      </a>
                    )}
                  </div>
                )}
                {likedSongs !== null && (
                  <div className="spotify-library">
                    <strong>Your Liked Songs</strong>
                    <p className="panel-sub">Choose a song to add to your study player. Spotify does not expose Liked Songs as one embeddable playlist.</p>
                    {likedSongs.length === 0 ? (
                      <p className="panel-sub">No saved tracks found.</p>
                    ) : (
                      <ul>
                        {likedSongs.map(track => (
                          <li key={track.id}>
                            <span className="spotify-liked-track">
                              <strong>{track.name}</strong>
                              {track.artist && <small>{track.artist}</small>}
                            </span>
                            <button className="button button-secondary" type="button" disabled={pending}
                              onClick={() => run(() => addSpotifyLink({ url: track.url, label: track.name.slice(0, 80) }), 'Song added to your study player')}>
                              <Plus size={14} /> Add
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {likedNextOffset !== null && (
                      <button className="button button-secondary spotify-more-button" type="button"
                        disabled={pending} onClick={() => loadLikedSongs(likedNextOffset)}>
                        Load more liked songs
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="spotify-account-empty">
            <div>
              <strong>Connect your Spotify profile</strong>
              <p>Link your Spotify account to see your name, photo and playlists in this workspace.</p>
            </div>
            {accountConnectEnabled ? (
              <a href="/api/spotify/connect" className="button button-primary">
                <Link2 size={16} /> Connect Spotify
              </a>
            ) : (
              <span className="spotify-account-setup">Account linking requires Spotify app setup</span>
            )}
          </div>
        )}
      </div>

      {visible && (
        <>
          {links.length > 0 && (
            <div className="spotify-switcher">
              <label htmlFor="spotify-selection">Now selected</label>
              <select id="spotify-selection" value={selected?.id ?? ''} disabled={pending}
                onChange={event => run(() => selectSpotifyLink(event.target.value), 'Music changed')}>
                {links.map(link => <option key={link.id} value={link.id}>{link.label} · {link.kind}</option>)}
              </select>
              <button className="tiny-button" type="button" aria-label="Remove selected Spotify link" disabled={pending}
                onClick={() => selected && run(() => removeSpotifyLink(selected.id), 'Music removed')}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
          {selected ? (
            <iframe
              key={selected.id}
              className="spotify-frame"
              title={'Spotify ' + selected.kind + ': ' + selected.label}
              src={'https://open.spotify.com/embed/' + selected.kind + '/' + selected.spotifyId}
              allow="encrypted-media; clipboard-write"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <p className="spotify-empty">Connect your Spotify account or add a playlist or liked song to keep focus music close.</p>
          )}
          <form className="spotify-form" onSubmit={event => {
            event.preventDefault()
            run(async () => {
              const result = await addSpotifyLink({ url, label })
              if (result.ok) { setUrl(''); setLabel('') }
              return result
            }, 'Music saved')
          }}>
            <div className="field">
              <label htmlFor="spotify-label">Name</label>
              <input id="spotify-label" className="input" value={label} onChange={event => setLabel(event.target.value)}
                maxLength={80} placeholder="Deep focus" required />
            </div>
            <div className="field">
              <label htmlFor="spotify-url">Spotify link</label>
              <input id="spotify-url" className="input" type="url" value={url} onChange={event => setUrl(event.target.value)}
                placeholder="https://open.spotify.com/playlist/..." required />
            </div>
            <button className="button button-primary" type="submit" disabled={pending}><Plus size={16} /> Save</button>
          </form>
        </>
      )}
    </section>
  )
}
