import type { Metadata } from 'next'
import { PublicSubjects } from '@/components/public-subjects'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Subjects', description: 'Explore study subjects and time invested in each learning area.' }
export default function Subjects() { return <PublicSubjects/> }
