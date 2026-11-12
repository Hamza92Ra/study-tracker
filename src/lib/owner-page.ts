import { redirect } from 'next/navigation'
import { currentAccount } from './auth'

export async function ownerPage() {
  const account = await currentAccount()
  if (!account) redirect('/manage/login')
  if (account.mustChangePassword) redirect('/manage/change-password')
  return account
}
