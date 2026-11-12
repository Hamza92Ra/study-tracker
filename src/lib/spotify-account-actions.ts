'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  decryptSpotifyToken, encryptSpotifyToken, fetchSpotifyPlaylists, fetchSpotifyLikedSongs,
  requestSpotifyToken, spotifyClientId,
} from '@/lib/spotify-oauth'

export async function disconnectSpotifyAccount() {
  try {
    const owner = await requireOwner()
    await prisma.spotifyAccount.deleteMany({ where: { ownerId: owner.id } })
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
