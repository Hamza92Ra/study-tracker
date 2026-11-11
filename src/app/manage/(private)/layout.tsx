import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ManageNav } from '@/components/nav'
import { prisma } from '@/lib/db'
export const dynamic='force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }
export default async function PrivateLayout({children}:{children:React.ReactNode}){const session=await getServerSession(authOptions);if(!session?.user?.id)redirect('/manage/login');const settings=await prisma.userSettings.findUnique({where:{ownerId:session.user.id}});return <div className="manage-shell"><ManageNav preference={settings?.themePreference}/><main className="manage-main">{children}</main></div>}
