import Link from 'next/link'
import { ArrowUpRight, BookOpen, ChartColumn, Clock3, LayoutDashboard, List, Settings, Users } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { Brand } from './brand'

export function PublicNav() {
  return (
    <header className="public-nav">
      <div className="nav-inner">
        <Brand />
        <nav aria-label="Public navigation">
          <Link href="/">Overview</Link>
          <Link href="/activity">Activity</Link>
          <Link href="/subjects">Subjects</Link>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className="nav-login" href="/manage/login">Owner space <ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </header>
  )
}

const links = [
  ['/manage', 'Overview', LayoutDashboard],
  ['/manage/sessions', 'Sessions', Clock3],
  ['/manage/subjects', 'Subjects', BookOpen],
  ['/manage/analytics', 'Analytics', ChartColumn],
  ['/manage/settings', 'Settings', Settings],
] as const

export function ManageNav({
  preference,
  avatarUrl,
  displayName,
  isAdmin = false,
}: {
  preference?: string
  avatarUrl?: string | null
  displayName?: string | null
  isAdmin?: boolean
}) {
  return (
    <aside className="manage-nav">
      <Brand href="/manage" />
      <p className="nav-overline">WORKSPACE</p>
      <nav aria-label="Management navigation">
        {links.map(([href, label, Icon]) => (
          <Link key={href} href={href}><Icon size={18} />{label}</Link>
        ))}
        {isAdmin && <Link href="/manage/admin"><Users size={18} />People</Link>}
      </nav>
      <div className="manage-nav-footer">
        <div className="manage-account-chip">
          <span className="manage-account-avatar">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (displayName?.slice(0, 1).toUpperCase() || '?')}
          </span>
          <span className="manage-account-details">
            <strong>{displayName || 'My account'}</strong>
            <small>{isAdmin ? 'Administrator' : 'Member'}</small>
          </span>
        </div>
        <ThemeToggle preference={preference} />
        <Link href="/" target="_blank"><List size={16} /> View public site</Link>
      </div>
    </aside>
  )
}
