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
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      _count: { select: { subjects: true, sessions: true } },
    },
  })

  const people = accounts.map(({ createdAt, ...account }) => ({
    ...account,
    createdAt: createdAt.toISOString(),
  }))

  return (
    <>
      <ManageHeader eyebrow="Administration" title="People" />
      <p className="page-intro">Manage everyone including administrators, create private accounts, and change user roles. Each person keeps their own workspace.</p>
      <UserAdmin members={people} currentUserId={current.id} />
    </>
  )
}
