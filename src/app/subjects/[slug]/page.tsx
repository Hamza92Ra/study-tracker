import type { Metadata } from 'next'
import { PublicSubject } from '@/components/public-subject'
export const dynamic = 'force-dynamic'
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;return {title:slug.replace(/-/g,' '),description:'Study statistics and recent sessions for this subject.'}}
export default async function Subject({params}:{params:Promise<{slug:string}>}) { const {slug}=await params; return <PublicSubject slug={slug}/> }
