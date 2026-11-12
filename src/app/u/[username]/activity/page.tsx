import type { Metadata } from 'next'
import { PublicActivity } from '@/components/public-activity'
import { publicOwner } from '@/lib/data'
import { notFound } from 'next/navigation'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Activity history' }
export default async function Activity({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ subject?: string; search?: string; from?: string; to?: string; page?: string }> }) {
  const { username } = await params
  if (!await publicOwner(username)) notFound()
  return <PublicActivity username={username} searchParams={searchParams}/>
}
