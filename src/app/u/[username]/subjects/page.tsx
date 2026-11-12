import type { Metadata } from 'next'
import { PublicSubjects } from '@/components/public-subjects'
import { publicOwner } from '@/lib/data'
import { notFound } from 'next/navigation'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Subjects' }
export default async function Subjects({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  if (!await publicOwner(username)) notFound()
  return <PublicSubjects username={username}/>
}
