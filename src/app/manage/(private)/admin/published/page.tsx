import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ManageHeader } from '@/components/manage-header'
import { ownerPage } from '@/lib/owner-page'
import { publishedActivity, type PublishedFilters } from '@/lib/published-activity'
import { duration, initials } from '@/lib/format'
import { addCalendarDays, localDay, localLabel } from '@/lib/time'

export const metadata: Metadata = { title: 'Published Activity · Admin', robots: { index: false, follow: false } }

function weekLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default async function PublishedActivityPage({ searchParams }: { searchParams: Promise<PublishedFilters> }) {
  const current = await ownerPage()
  if (current.role !== 'admin') notFound()
  const data = await publishedActivity(await searchParams)
  const { people, subjectTotals, totalSeconds, filteredCount, sessions, weekly, zone, page, pages, filters } = data
  const filteredUrl = (nextPage: number) => {
    const params = new URLSearchParams()
    for (const key of ['username', 'subject', 'from', 'to'] as const) if (filters[key]) params.set(key, filters[key])
    params.set('page', String(nextPage))
    return `/manage/admin/published?${params}`
  }
  const maxWeek = Math.max(1, ...weekly.map(week => week.seconds))
  return <>
    <ManageHeader eyebrow="Administration" title="Published Activity" />
    <p className="page-intro">A published-only view of study activity across accounts. Private sessions and notes stay in each person&apos;s workspace.</p>
    <div className="published-stats" aria-label="Published activity totals">
      <div className="stat-card"><span className="stat-label">All published study time</span><strong className="stat-value">{duration(totalSeconds)}</strong></div>
      <div className="stat-card"><span className="stat-label">Registered people</span><strong className="stat-value">{people.length}</strong></div>
      <div className="stat-card"><span className="stat-label">Published subjects</span><strong className="stat-value">{subjectTotals.length}</strong></div>
    </div>
    <section className="activity-panel published-weekly" aria-labelledby="published-weekly-title">
      <div className="activity-panel-heading"><div><span className="eyebrow">ALL ACCOUNTS</span><h2 id="published-weekly-title">Weekly published activity</h2><p>The most recent 12 Monday–Sunday weeks, shown in your local study calendar</p></div></div>
      <div className="weekly-rows">{weekly.map(week => <div className="weekly-row" key={week.start} title={`${weekLabel(week.start)}–${weekLabel(addCalendarDays(week.start, 6))}: ${duration(week.seconds)}`}>
        <span className="weekly-label">{weekLabel(week.start)}–{weekLabel(addCalendarDays(week.start, 6))}</span>
        <span className="weekly-track"><span style={{ width: `${week.seconds / maxWeek * 100}%` }} /></span>
        <strong>{duration(week.seconds)}</strong>
      </div>)}</div>
    </section>
    <div className="published-columns">
      <section className="card panel" aria-labelledby="published-people-title">
        <div className="panel-head"><div><h2 id="published-people-title">People</h2><p className="panel-sub">All registered accounts · published time only</p></div></div>
        <div className="published-people">{people.map(person => <div className="published-person" key={person.id}>
          <span className="published-avatar">{person.avatarUrl ? <Image unoptimized src={person.avatarUrl} width={42} height={42} alt="" referrerPolicy="no-referrer" /> : initials(person.displayName)}</span>
          <span className="published-person-name"><strong>{person.displayName}</strong><small>@{person.username}{!person.isActive ? ' · inactive' : person.settings?.profileVisibility === 'private' ? ' · private profile' : ''}</small></span>
          <strong className="published-time">{duration(person.seconds)}</strong>
          <span className="published-person-links"><Link href={filteredUrlForUser(person.username)} aria-label={`View ${person.username} published sessions`}>Sessions</Link>{person.isActive && person.settings?.profileVisibility !== 'private' && <Link href={`/u/${person.username}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${person.username} public profile`}>Profile ↗</Link>}</span>
        </div>)}</div>
      </section>
      <section className="card panel" aria-labelledby="published-subjects-title">
        <div className="panel-head"><div><h2 id="published-subjects-title">By subject</h2><p className="panel-sub">Published time for each person&apos;s subjects</p></div></div>
        {subjectTotals.length ? <div className="published-subjects">{subjectTotals.map(subject => <div className="published-subject" key={subject.id}>
          <span className="subject-dot" style={{ background: subject.color }} />
          <span><strong>{subject.name}</strong><small>@{subject.username} · {subject.count} {subject.count === 1 ? 'session' : 'sessions'}</small></span>
          <strong>{duration(subject.seconds)}</strong>
        </div>)}</div> : <p className="panel-sub">No published study time yet.</p>}
      </section>
    </div>
    <section aria-labelledby="published-sessions-title">
      <div className="section-heading"><div><span className="eyebrow">Published study log</span><h2 id="published-sessions-title">Sessions</h2><p>{filteredCount} matching {filteredCount === 1 ? 'session' : 'sessions'}</p></div></div>
      <form className="card filter-bar published-filters" action="/manage/admin/published">
        <div className="field"><label htmlFor="published-user">Username</label><select id="published-user" name="username" defaultValue={filters.username}><option value="">All users</option>{people.map(person => <option key={person.id} value={person.username}>@{person.username}</option>)}</select></div>
        <div className="field"><label htmlFor="published-subject">Subject</label><select id="published-subject" name="subject" defaultValue={filters.subject}><option value="">All subjects</option>{subjectTotals.map(subject => <option key={subject.id} value={subject.id}>@{subject.username} · {subject.name}</option>)}</select></div>
        <div className="field"><label htmlFor="published-from">From</label><input className="input" id="published-from" name="from" type="date" defaultValue={filters.from} /></div>
        <div className="field"><label htmlFor="published-to">To</label><input className="input" id="published-to" name="to" type="date" defaultValue={filters.to} /></div>
        <button className="button button-primary" type="submit">Apply filters</button><Link className="button button-secondary" href="/manage/admin/published">Reset</Link>
      </form>
      <div className="card panel published-sessions">{sessions.length ? sessions.map(session => <article className="published-session" key={session.id}>
        <div className="published-session-main"><strong>{session.title}</strong><span><span className="subject-dot" style={{ background: session.subject.color }} /> {session.subject.name} · <Link href={`/u/${session.owner.username}`}>@{session.owner.username}</Link></span></div>
        <div className="published-session-meta"><strong>{duration(session.durationSeconds)}</strong><span>{localLabel(session.startedAt, zone, 'MMM d, yyyy')}</span><span>{localLabel(session.startedAt, zone, 'h:mm a')}–{localLabel(session.endedAt, zone, localDay(session.startedAt, zone) === localDay(session.endedAt, zone) ? 'h:mm a' : 'MMM d, h:mm a')}</span></div>
      </article>) : <div className="empty-state"><h3>No published sessions found</h3><p>Try another user, subject, or date range.</p></div>}</div>
      <div className="pagination"><span>Page {page} of {pages}</span><div className="flex gap-2">{page > 1 && <Link href={filteredUrl(page - 1)}>Previous</Link>}{page < pages && <Link href={filteredUrl(page + 1)}>Next</Link>}</div></div>
    </section>
  </>
}

function filteredUrlForUser(username: string) { return `/manage/admin/published?username=${encodeURIComponent(username)}` }
