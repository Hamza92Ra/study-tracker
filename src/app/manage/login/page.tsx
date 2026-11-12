import { publicOwner } from '@/lib/data'
import { LoginForm } from '@/components/login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const owner = await publicOwner()
  return <LoginForm avatarUrl={owner?.avatarUrl} displayName={owner?.displayName} />
}
