import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ManageNav } from '@/components/nav'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/manage/login')

  const owner = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      avatarUrl: true,
      displayName: true,
      settings: { select: { themePreference: true } },
    },
  })
  if (!owner) redirect('/manage/login')

  return (
    <div className="manage-shell">
      <ManageNav
        preference={owner.settings?.themePreference}
        avatarUrl={owner.avatarUrl}
        displayName={owner.displayName}
      />
      <main className="manage-main">{children}</main>
    </div>
  )
}
