import type { Metadata } from 'next'
import { PublicSubject } from '@/components/public-subject'
import { publicOwner } from '@/lib/data'
import { notFound } from 'next/navigation'
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ username: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return { title: slug.replace(/-/g, ' ') }
}
export default async function Subject({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params
  if (!await publicOwner(username)) notFound()
  return <PublicSubject username={username} slug={slug}/>
}
