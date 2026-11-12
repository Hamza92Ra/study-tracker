import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ownerPage } from '@/lib/owner-page'
import { prisma } from '@/lib/db'
import { ManageHeader } from '@/components/manage-header'
import { UserAdmin } from '@/components/user-admin'

export const metadata: Metadata = { title: 'People · Admin', robots: { index: false, follow: false } }

export default async function AdminPage() {
  const current = await ownerPage()
  if (current.role !== 'admin') notFound()

  const accounts = await prisma.user.findMany({
    where: { role: 'member' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      _count: { select: { subjects: true, sessions: true } },
    },
  })

  const members = accounts.map(({ createdAt, ...account }) => ({
    ...account,
    createdAt: createdAt.toISOString(),
  }))

  return (
    <>
      <ManageHeader eyebrow="Administration" title="People" />
      <p className="page-intro">Create private study accounts, manage access and issue replacement passwords. Each person sees only their own workspace.</p>
      <UserAdmin members={members} />
    </>
  )
}
