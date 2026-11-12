import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentAccount } from '@/lib/auth'
import { ManageNav } from '@/components/nav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount()
  if (!account) redirect('/manage/login')
  const preference = await import('@/lib/db').then(({ prisma }) =>
    prisma.userSettings.findUnique({ where: { ownerId: account.id }, select: { themePreference: true } })
  )
  return (
    <div className="manage-shell">
      <ManageNav
        preference={preference?.themePreference}
        avatarUrl={account.avatarUrl}
        displayName={account.displayName}
        isAdmin={account.role === 'admin'}
      />
      <main className="manage-main">{children}</main>
    </div>
  )
}
