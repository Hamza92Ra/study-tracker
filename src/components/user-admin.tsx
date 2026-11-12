'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createMember, resetMemberPassword, setMemberStatus, setAccountRole } from '@/lib/admin-actions'

type Member = {
  id: string
  username: string
  email: string
  displayName: string
  role: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  _count: { subjects: number; sessions: number }
}

type Credentials = { username: string; temporaryPassword: string }

export function UserAdmin({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  const active = members.filter(member => member.isActive).length
  const admins = members.filter(member => member.role === 'admin').length

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setCredentials(null)
    setLoading('create')
    const result = await createMember({ username, email, displayName })
    setLoading('')
    if (!result.ok) {
      setError(result.error)
      toast.error(result.error)
      return
    }
    setCredentials({ username: result.username, temporaryPassword: result.temporaryPassword })
    setDisplayName('')
    setUsername('')
    setEmail('')
    toast.success('Member created')
    router.refresh()
  }

  async function onStatus(member: Member) {
    const verb = member.isActive ? 'suspend' : 'reactivate'
    if (!window.confirm(`Do you want to ${verb} @${member.username}?`)) return
    setError('')
    setCredentials(null)
    setLoading(member.id)
    const result = await setMemberStatus(member.id, !member.isActive)
    setLoading('')
    if (!result.ok) {
      setError(result.error)
      toast.error(result.error)
    } else {
      toast.success(`Account ${member.isActive ? 'suspended' : 'reactivated'}`)
      router.refresh()
    }
  }

  async function onReset(member: Member) {
    if (!window.confirm(`Reset password for @${member.username}? Existing sessions will be revoked.`)) return
    setError('')
    setCredentials(null)
    setLoading(member.id)
    const result = await resetMemberPassword(member.id)
    setLoading('')
    if (!result.ok) {
      setError(result.error)
      toast.error(result.error)
      return
    }
    setCredentials({ username: member.username, temporaryPassword: result.temporaryPassword })
    toast.success('Temporary password created')
    router.refresh()
  }

  async function onRole(member: Member) {
    const role = member.role === 'admin' ? 'member' : 'admin'
    const question = role === 'admin'
      ? `Promote @${member.username} to Admin? They will be able to create users, promote other admins and manage accounts.`
      : `Remove administrator privileges from @${member.username}?`
    if (!window.confirm(question)) return
    setError('')
    setCredentials(null)
    setLoading(member.id)
    const result = await setAccountRole(member.id, role)
    setLoading('')
    if (!result.ok) {
      setError(result.error)
      toast.error(result.error)
    } else {
      toast.success(`@${member.username} is now ${role === 'admin' ? 'an Admin' : 'a Member'}`)
      router.refresh()
    }
  }

  return (
    <div className="admin-people-stack">
      <section className="card manage-card">
        <div className="panel-head">
          <div>
            <h2 className="admin-people-title">People</h2>
            <p className="panel-sub">{members.length} total · {admins} admin{admins === 1 ? '' : 's'} · {members.length - admins} member{members.length - admins === 1 ? '' : 's'} · {active} active</p>
          </div>
          <span className="badge">Admin only</span>
        </div>

        {members.length === 0 ? (
          <div className="empty-state">
            <h3>No accounts found</h3>
            <p>Create the first member below. Their private workspace will be ready immediately.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Person</th><th>Role</th><th>Status</th><th>Subjects</th><th>Sessions</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id}>
                    <td>
                      <strong className="admin-member-name">{member.displayName}</strong>
                      <span className="admin-member-sub">@{member.username} · {member.email}</span>
                      {member.id === currentUserId && <span className="admin-you-mark">You</span>}
                    </td>
                    <td><span className={`badge ${member.role === 'admin' ? 'admin-role-badge' : ''}`}>{member.role === 'admin' ? 'Admin' : 'Member'}</span></td>
                    <td>
                      <span className={`badge ${member.isActive ? 'admin-member-active' : 'admin-member-suspended'}`}>
                        {member.isActive ? (member.mustChangePassword ? 'Setup pending' : 'Active') : 'Suspended'}
                      </span>
                    </td>
                    <td>{member._count.subjects}</td>
                    <td>{member._count.sessions}</td>
                    <td>{new Date(member.createdAt).toLocaleDateString()}</td>
                    <td>
                      {member.id === currentUserId ? (
                        <span className="admin-current-account">Current account</span>
                      ) : (
                        <div className="admin-member-buttons">
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={loading !== '' || !member.isActive}
                            onClick={() => onRole(member)}
                          >{member.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={loading !== ''}
                            onClick={() => onReset(member)}
                          >Reset password</button>
                          <button
                            type="button"
                            className={`button ${member.isActive ? 'button-danger' : 'button-secondary'}`}
                            disabled={loading !== ''}
                            onClick={() => onStatus(member)}
                          >{member.isActive ? 'Suspend' : 'Reactivate'}</button>
                        </div>
                      )>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card manage-card">
        <div className="panel-head">
          <div>
            <h2 className="admin-people-title">Add a member</h2>
            <p className="panel-sub">Only an admin can create accounts. Registration is closed to the public.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onCreate}>
          <div className="field">
            <label htmlFor="new-display-name">Display name</label>
            <input className="input" id="new-display-name" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={100} required />
          </div>
          <div className="field">
            <label htmlFor="new-username">Username</label>
            <input className="input" id="new-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" placeholder="e.g. student_01" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_-]{3,32}" required />
          </div>
          <div className="field full">
            <label htmlFor="new-email">Email</label>
            <input className="input" id="new-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" maxLength={254} required />
          </div>
          <div className="full">
            <button className="button button-primary" type="submit" disabled={loading !== ''}>
              {loading === 'create' ? 'Creating…' : 'Create member account'}
            </button>
          </div>
        </form>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {credentials && (
        <section className="card manage-card admin-credentials" aria-live="polite">
          <h2 className="admin-people-title">One-time login credentials</h2>
          <p>Copy this password now and share it privately with the member. It will not be displayed again.</p>
          <p><strong>Username:</strong> {credentials.username}</p>
          <div className="admin-credentials-row">
            <code className="admin-credential-value">{credentials.temporaryPassword}</code>
            <button className="button button-secondary" type="button" onClick={() => {
              navigator.clipboard.writeText(credentials.temporaryPassword)
                .then(() => toast.success('Password copied'))
                .catch(() => toast.error('Copy the password manually'))
            }}>Copy password</button>
          </div>
          <p>The member signs in at <code>/manage/login</code> and must change the temporary password before using their workspace.</p>
          <button className="button button-ghost" type="button" onClick={() => setCredentials(null)}>Hide credentials</button>
        </section>
      )}
    </div>
  )
}
