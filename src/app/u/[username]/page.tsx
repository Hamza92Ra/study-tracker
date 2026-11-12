import type { Metadata } from 'next'
import { PublicOverview } from '@/components/public-overview'
import { publicOwner } from '@/lib/data'
import { notFound } from 'next/navigation'
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const owner = await publicOwner(username)
  return { title: owner ? `${owner.displayName} · Study profile` : 'Profile unavailable', robots: owner ? undefined : { index: false, follow: false } }
}
export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  if (!await publicOwner(username)) notFound()
  return <PublicOverview username={username}/>
}
