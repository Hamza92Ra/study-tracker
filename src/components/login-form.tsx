'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Brand } from './brand'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError('')
    const data = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      identifier: String(data.get('identifier')),
      password: String(data.get('password')),
      redirect: false,
    })
    setPending(false)
    if (result?.ok) router.push('/manage')
    else setError('Unable to sign in. Check your credentials or try again later.')
  }

  return (
    <main className="login-page">
      <div className="card login-box">
        <Brand />
        <span className="eyebrow">Private workspace</span>
        <h1>Welcome back.</h1>
        <p>Sign in to manage your study time and share your progress.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="identifier">Username or email</label>
            <input className="input" id="identifier" name="identifier" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <Link className="login-back" href="/">← Back to public dashboard</Link>
      </div>
    </main>
  )
}
