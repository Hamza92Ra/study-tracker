import type { Metadata } from 'next'
import { PublicActivity } from '@/components/public-activity'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Activity history', description: 'Browse published study sessions and learning activity.' }
export default function Activity({ searchParams }: { searchParams: Promise<{ subject?: string; search?: string; from?: string; to?: string; page?: string }> }) { return <PublicActivity searchParams={searchParams}/> }
