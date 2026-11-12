import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { currentAccount } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  encryptSpotifyToken, fetchSpotifyProfile, requestSpotifyToken,
  spotifyCallbackUrl, spotifyClientId, verifySpotifyAuthState,
} from '@/lib/spotify-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function finish(status: string, error = false) {
  const url = new URL('/manage', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  url.searchParams.set(error ? 'spotify_error' : 'spotify', status)
  const response = NextResponse.redirect(url)
  // Delete the one-use secret even after a failed or denied Spotify authorization.
  response.cookies.set({
    name: 'study_spotify_oauth', value: '', maxAge: 0,
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/api/spotify',
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(request: NextRequest) {
  const account = await currentAccount()
  if (!account || account.mustChangePassword) return finish('session', true)

  const state = request.nextUrl.searchParams.get('state')
  const token = verifySpotifyAuthState(
    request.cookies.get('study_spotify_oauth')?.value, state, account.id
  )
  if (!token) return finish('invalid_state', true)

  const denied = request.nextUrl.searchParams.get('error')
  if (denied) return finish('cancelled', true)
  const code = request.nextUrl.searchParams.get('code')
  if (!code || code.length > 4096) return finish('invalid_code', true)
  const clientId = spotifyClientId()
  if (!clientId) return finish('not_configured', true)

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyCallbackUrl(),
      client_id: clientId,
      code_verifier: token.verifier,
    })
    const granted = await requestSpotifyToken(body)
    // An initial grant must provide a refresh token to persist the connection.
    if (!granted.refresh_token) return finish('missing_refresh_token', true)
    const profile = await fetchSpotifyProfile(granted.access_token)
    await prisma.spotifyAccount.upsert({
      where: { ownerId: account.id },
      create: {
        ownerId: account.id,
        ...profile,
        encryptedAccessToken: encryptSpotifyToken(granted.access_token),
        encryptedRefreshToken: encryptSpotifyToken(granted.refresh_token),
        expiresAt: new Date(Date.now() + Math.max(1, granted.expires_in - 60) * 1000),
      },
      update: {
        ...profile,
        encryptedAccessToken: encryptSpotifyToken(granted.access_token),
        encryptedRefreshToken: encryptSpotifyToken(granted.refresh_token),
        expiresAt: new Date(Date.now() + Math.max(1, granted.expires_in - 60) * 1000),
      },
    })
    return finish('connected')
  } catch (error) {
    // Spotify identities are unique across Study Ledger accounts.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return finish('already_linked', true)
    }
    return finish('connection_failed', true)
  }
}
