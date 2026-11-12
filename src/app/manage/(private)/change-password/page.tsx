import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentAccount } from '@/lib/auth'
import { ManageHeader } from '@/components/manage-header'
import { ChangePasswordForm } from '@/components/change-password-form'

export const metadata: Metadata = { title: 'Change password', robots: { index: false, follow: false } }
export default async function ChangePasswordPage() {
  const account = await currentAccount()
  if (!account) redirect('/manage/login')

  return (
    <>
      <ManageHeader eyebrow="Account security" title="Change password" />
      <p className="page-intro">
        {account.mustChangePassword
          ? 'Welcome to your workspace. Replace your temporary password to get started.'
          : 'Choose a new password for your account. Your existing sessions will be signed out.'}
      </p>
      <ChangePasswordForm />
    </>
  )
}
