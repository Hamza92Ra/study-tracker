import { NextRequest, NextResponse } from 'next/server'
import { currentAccount } from '@/lib/auth'
import {
  createSpotifyAuthState, spotifyAuthorizationUrl, spotifyCallbackUrl,
  spotifyClientId, spotifyCodeChallenge,
} from '@/lib/spotify-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function returnToApp(code: string) {
  const uri = new URL('/manage', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  uri.searchParams.set('spotify_error', code)
  return NextResponse.redirect(uri)
}

export async function GET(_request: NextRequest) {
  const user = await currentAccount()
  if (!user) return NextResponse.redirect(new URL('/manage/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))
  if (user.mustChangePassword) return NextResponse.redirect(new URL('/manage/change-password', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))
  const clientId = spotifyClientId()
  if (!clientId) return returnToApp('not_configured')

  const auth = createSpotifyAuthState(user.id)
  const spotifyUrl = spotifyAuthorizationUrl(clientId, auth.state, spotifyCodeChallenge(auth.verifier), spotifyCallbackUrl())
  const response = NextResponse.redirect(spotifyUrl)
  response.cookies.set({
    name: 'study_spotify_oauth', value: auth.cookie,
    maxAge: 600, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/api/spotify',
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
