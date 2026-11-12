'use client'

import { type FormEvent, useState } from 'react'
import { signOut } from 'next-auth/react'
import { changeOwnPassword } from '@/lib/admin-actions'
import { toast } from 'sonner'

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    const result = await changeOwnPassword({ currentPassword, newPassword })
    if (!result.ok) {
      setBusy(false)
      setError(result.error)
      toast.error(result.error)
      return
    }
    toast.success('Password updated. Please sign in again.')
    await signOut({ callbackUrl: '/manage/login' })
  }

  return (
    <form className="card manage-card admin-password-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="current-password">Current or temporary password</label>
        <input id="current-password" type="password" autoComplete="current-password" className="input" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="new-password">New password (at least 12 characters)</label>
        <input id="new-password" type="password" autoComplete="new-password" className="input" minLength={12} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" className="input" minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? 'Updating…' : 'Change password'}
      </button>
    </form>
  )
}
