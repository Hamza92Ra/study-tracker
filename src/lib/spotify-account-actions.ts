'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fetchLikedTrackBatch, createPrivateLikedPlaylist, writeLikedPlaylistBatch } from '@/lib/spotify-liked-playlist-api'
import {
  decryptSpotifyToken, encryptSpotifyToken, fetchSpotifyPlaylists, fetchSpotifyLikedSongs, fetchSpotifyNowPlaying,
  requestSpotifyToken, spotifyClientId,
} from '@/lib/spotify-oauth'

export async function disconnectSpotifyAccount() {
  try {
    const owner = await requireOwner()
    await prisma.$transaction([
      prisma.spotifyLikedMirror.deleteMany({ where: { ownerId: owner.id } }),
      prisma.spotifyAccount.deleteMany({ where: { ownerId: owner.id } }),
    ])
    // Existing pasted/saved Spotify embeds remain in the workspace.
    revalidatePath('/manage')
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: 'Could not disconnect Spotify. Please try again.' }
  }
}

async function validSpotifyAccessToken(ownerId: string) {
  const linked = await prisma.spotifyAccount.findUnique({ where: { ownerId } })
  if (!linked) throw new Error('Connect your Spotify account first.')
  if (linked.expiresAt.getTime() > Date.now() + 10_000) {
    return decryptSpotifyToken(linked.encryptedAccessToken)
  }
  const clientId = spotifyClientId()
  if (!clientId) throw new Error('Spotify connection is not configured.')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decryptSpotifyToken(linked.encryptedRefreshToken),
    client_id: clientId,
  })
  const refreshed = await requestSpotifyToken(body)
  const previousRefreshToken = linked.encryptedRefreshToken
  // Spotify may rotate refresh tokens; always persist replacements encrypted.
  await prisma.spotifyAccount.updateMany({
    where: { ownerId, encryptedRefreshToken: previousRefreshToken },
    data: {
      encryptedAccessToken: encryptSpotifyToken(refreshed.access_token),
      ...(refreshed.refresh_token ? { encryptedRefreshToken: encryptSpotifyToken(refreshed.refresh_token) } : {}),
      expiresAt: new Date(Date.now() + Math.max(1, refreshed.expires_in - 60) * 1000),
    },
  })
  return refreshed.access_token
}

export async function loadSpotifyAccountPlaylists() {
  try {
    const owner = await requireOwner()
    const token = await validSpotifyAccessToken(owner.id)
    const playlists = await fetchSpotifyPlaylists(token)
    return { ok: true as const, playlists }
  } catch (error) {
    if (error instanceof Error && /Spotify|Connect/.test(error.message)) {
      return { ok: false as const, error: error.message }
    }
    return { ok: false as const, error: 'Could not load playlists. Try reconnecting Spotify.' }
  }
}


export async function loadSpotifyLikedSongs(offset: number = 0) {
  try {
    const owner = await requireOwner()
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || offset % 20 !== 0) {
      return { ok: false as const, error: 'Invalid Liked Songs page.' }
    }
    const token = await validSpotifyAccessToken(owner.id)
    const page = await fetchSpotifyLikedSongs(token, offset)
    return { ok: true as const, ...page }
  } catch (error) {
    if (error instanceof Error && /Spotify|Liked Songs|Connect/.test(error.message)) {
      return { ok: false as const, error: error.message }
    }
    return { ok: false as const, error: 'Could not load Liked Songs. Please try reconnecting Spotify.' }
  }
}


/** Only returns the authenticated workspace owner's private playback metadata. */
export async function loadSpotifyNowPlaying() {
  try {
    const owner = await requireOwner()
    const token = await validSpotifyAccessToken(owner.id)
    const playback = await fetchSpotifyNowPlaying(token)
    return { ok: true as const, playback }
  } catch (error) {
    if (error instanceof Error && /Reconnect Spotify/.test(error.message)) {
      return { ok: false as const, error: error.message, reconnect: true as const }
    }
    if (error instanceof Error && /Spotify is temporarily limiting/.test(error.message)) {
      return { ok: false as const, error: error.message, reconnect: false as const }
    }
    return { ok: false as const, error: 'Could not check Spotify playback right now.', reconnect: false as const }
  }
}


const mirrorLabel = 'Liked Songs — Full Playlist'

function mirrorProgress(mirror: {
  spotifyPlaylistId: string; importedCount: number; totalCount: number;
  nextOffset: number; completedAt: Date | null;
}) {
  return {
    playlistId: mirror.spotifyPlaylistId,
    importedCount: mirror.importedCount,
    totalCount: mirror.totalCount,
    done: mirror.completedAt !== null,
  }
}

function mirrorError(error: unknown) {
  if (error instanceof Error && /^(Reconnect Spotify|Spotify is limiting requests|Spotify could not|Invalid Liked Songs)/.test(error.message)) {
    return error.message
  }
  return 'Could not sync your Liked Songs playlist. Your existing progress is saved.'
}

/**
 * External Spotify writes happen ONLY when the signed-in user clicks Create Playlist.
 * Creating and tracking a single private playlist per Study Ledger workspace
 * prevents duplicating Spotify playlists on a normal retry.
 */
export async function createLikedSongsPlaylist() {
  try {
    const owner = await requireOwner()
    const account = await prisma.spotifyAccount.findUnique({ where: { ownerId: owner.id } })
    if (!account) return { ok: false as const, error: 'Connect your Spotify account first.' }
    const existing = await prisma.spotifyLikedMirror.findUnique({ where: { ownerId: owner.id } })
    if (existing) {
      if (existing.spotifyAccountId !== account.spotifyAccountId) {
        return { ok: false as const, error: 'This copy belongs to another Spotify account. Disconnect and reconnect first.' }
      }
      return { ok: true as const, progress: mirrorProgress(existing) }
    }
    const token = await validSpotifyAccessToken(owner.id)
    const first = await fetchLikedTrackBatch(token, 0)
    if (first.total === 0) return { ok: false as const, error: 'There are no Liked Songs to copy yet.' }
    const playlistId = await createPrivateLikedPlaylist(token)
    const mirror = await prisma.$transaction(async tx => {
      const created = await tx.spotifyLikedMirror.create({
        data: {
          ownerId: owner.id,
          spotifyAccountId: account.spotifyAccountId,
          spotifyPlaylistId: playlistId,
          totalCount: first.total,
        },
      })
      const saved = await tx.spotifyLink.upsert({
        where: { ownerId_kind_spotifyId: { ownerId: owner.id, kind: 'playlist', spotifyId: playlistId } },
        create: { ownerId: owner.id, kind: 'playlist', spotifyId: playlistId, label: mirrorLabel },
        update: { label: mirrorLabel },
      })
      await tx.userSettings.upsert({
        where: { ownerId: owner.id },
        create: { ownerId: owner.id, selectedSpotifyLinkId: saved.id, spotifyWidgetVisible: true },
        update: { selectedSpotifyLinkId: saved.id, spotifyWidgetVisible: true },
      })
      return created
    })
    revalidatePath('/manage')
    return { ok: true as const, progress: mirrorProgress(mirror) }
  } catch (error) {
    return { ok: false as const, error: mirrorError(error) }
  }
}

/**
 * Copy one Spotify library page per request. The client may repeat this until
 * complete, and the persisted cursor allows resuming after refresh/errors.
 */
export async function syncLikedSongsPlaylistBatch() {
  const owner = await requireOwner()
  const account = await prisma.spotifyAccount.findUnique({ where: { ownerId: owner.id } })
  const mirror = await prisma.spotifyLikedMirror.findUnique({ where: { ownerId: owner.id } })
  if (!account || !mirror || mirror.spotifyAccountId !== account.spotifyAccountId) {
    return { ok: false as const, error: 'Connect Spotify and create your playlist first.' }
  }
  if (mirror.completedAt) return { ok: true as const, progress: mirrorProgress(mirror) }
  const now = new Date()
  const lockUntil = new Date(Date.now() + 45000)
  const claimed = await prisma.spotifyLikedMirror.updateMany({
    where: {
      ownerId: owner.id,
      nextOffset: mirror.nextOffset,
      completedAt: null,
      OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }],
    },
    data: { syncLockedUntil: lockUntil },
  })
  if (!claimed.count) return { ok: false as const, error: 'Import already running in another tab. Try again shortly.' }
  try {
    const token = await validSpotifyAccessToken(owner.id)
    const batch = await fetchLikedTrackBatch(token, mirror.nextOffset)
    if (batch.uris.length) await writeLikedPlaylistBatch(token, mirror.spotifyPlaylistId, batch.uris)
    const updated = await prisma.spotifyLikedMirror.update({
      where: { ownerId: owner.id },
      data: {
        nextOffset: batch.nextOffset ?? mirror.nextOffset + 50,
        importedCount: mirror.importedCount + batch.uris.length,
        totalCount: batch.total,
        completedAt: batch.nextOffset === null ? new Date() : null,
        syncLockedUntil: null,
      },
    })
    if (updated.completedAt) revalidatePath('/manage')
    return { ok: true as const, progress: mirrorProgress(updated) }
  } catch (error) {
    return { ok: false as const, error: mirrorError(error) }
  } finally {
    await prisma.spotifyLikedMirror.updateMany({
      where: { ownerId: owner.id, syncLockedUntil: lockUntil },
      data: { syncLockedUntil: null },
    })
  }
}

/**
 * Explicitly rebuild ONLY the playlist created by Study Ledger, not the
 * user's original Liked Songs or unrelated Spotify playlists.
 */
export async function refreshLikedSongsPlaylist() {
  const owner = await requireOwner()
  const account = await prisma.spotifyAccount.findUnique({ where: { ownerId: owner.id } })
  const mirror = await prisma.spotifyLikedMirror.findUnique({ where: { ownerId: owner.id } })
  if (!account || !mirror || mirror.spotifyAccountId !== account.spotifyAccountId) {
    return { ok: false as const, error: 'Connect Spotify and create your playlist first.' }
  }
  const now = new Date()
  const lockUntil = new Date(Date.now() + 45000)
  const claimed = await prisma.spotifyLikedMirror.updateMany({
    where: {
      ownerId: owner.id,
      OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }],
    },
    data: { syncLockedUntil: lockUntil },
  })
  if (!claimed.count) return { ok: false as const, error: 'Playlist sync is already running.' }
  try {
    const token = await validSpotifyAccessToken(owner.id)
    const first = await fetchLikedTrackBatch(token, 0)
    await writeLikedPlaylistBatch(token, mirror.spotifyPlaylistId, first.uris, true)
    const updated = await prisma.spotifyLikedMirror.update({
      where: { ownerId: owner.id },
      data: {
        nextOffset: first.nextOffset ?? 50,
        importedCount: first.uris.length,
        totalCount: first.total,
        completedAt: first.nextOffset === null ? new Date() : null,
        syncLockedUntil: null,
      },
    })
    revalidatePath('/manage')
    return { ok: true as const, progress: mirrorProgress(updated) }
  } catch (error) {
    return { ok: false as const, error: mirrorError(error) }
  } finally {
    await prisma.spotifyLikedMirror.updateMany({
      where: { ownerId: owner.id, syncLockedUntil: lockUntil },
      data: { syncLockedUntil: null },
    })
  }
}
