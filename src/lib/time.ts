import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
export const DEFAULT_TIMEZONE = 'Africa/Casablanca'
export function validTimezone(zone: string) { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true } catch { return false } }
export function localDay(date: Date, zone: string) { return formatInTimeZone(date, zone, 'yyyy-MM-dd') }
export function localLabel(date: Date, zone: string, pattern = 'MMM d, yyyy') { return formatInTimeZone(date, zone, pattern) }
export function startOfLocalDay(day: string, zone: string) { return fromZonedTime(`${day}T00:00:00`, zone) }
export function addCalendarDays(day: string, amount: number) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10) }
export function validDay(day: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false; const parsed = new Date(`${day}T12:00:00Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === day }
export function localDayRange(day: string, zone: string) { return { start: startOfLocalDay(day, zone), end: startOfLocalDay(addCalendarDays(day, 1), zone) } }
export type TimedSession = { startedAt: Date; endedAt: Date; durationSeconds: number }
// Allocate recorded seconds by actual elapsed time on each local calendar date.
export function dailyAllocation(sessions: TimedSession[], zone: string) {
  const totals = new Map<string, number>()
  for (const s of sessions) {
    const start = s.startedAt.getTime(), end = s.endedAt.getTime()
    if (end <= start || s.durationSeconds <= 0) continue
    let cursor = start
    while (cursor < end) {
      const day = localDay(new Date(cursor), zone)
      const boundary = startOfLocalDay(addCalendarDays(day, 1), zone).getTime()
      const next = Math.min(end, boundary > cursor ? boundary : end)
      totals.set(day, (totals.get(day) ?? 0) + s.durationSeconds * (next - cursor) / (end - start))
      cursor = next
    }
  }
  return totals
}
export function streaks(days: Map<string, number>, today: string) {
  const active = [...days].filter(([, seconds]) => seconds > 0).map(([day]) => day).sort()
  let longest = 0, run = 0, previous = ''
  for (const day of active) { run = previous && addCalendarDays(previous, 1) === day ? run + 1 : 1; longest = Math.max(longest, run); previous = day }
  let current = 0, day = days.get(today) ? today : addCalendarDays(today, -1)
  while ((days.get(day) ?? 0) > 0) { current++; day = addCalendarDays(day, -1) }
  return { current, longest, activeDays: active.length }
}
export function goalProgress(days: Map<string, number>, today: string, targetMinutes: number) {
  const completed = Math.round((days.get(today) ?? 0) / 60)
  const monday = weekStart(today)
  const elapsedDays = Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${monday}T12:00:00Z`).getTime()) / 86400000) + 1
  let met = 0
  for (let i = 0; i < elapsedDays; i++) if ((days.get(addCalendarDays(monday, i)) ?? 0) >= targetMinutes * 60) met++
  return { completed, remaining: Math.max(0, targetMinutes - completed), percent: targetMinutes ? Math.min(100, Math.round(completed / targetMinutes * 100)) : 0, weeklyRate: Math.round(met / elapsedDays * 100) }
}
export function weekStart(day: string) { const d = new Date(`${day}T12:00:00Z`); const offset = (d.getUTCDay() + 6) % 7; return addCalendarDays(day, -offset) }
export function weeklySeries(days: Map<string, number>, today: string, count = 12) {
  const thisMonday = weekStart(today)
  return Array.from({length:count},(_,i)=>{ const start=addCalendarDays(thisMonday,(i-count+1)*7); let seconds=0; for(let j=0;j<7;j++) seconds+=days.get(addCalendarDays(start,j))??0; return { start, label: new Date(`${start}T12:00:00Z`).toLocaleDateString('en',{month:'short',day:'numeric'}), hours: Math.round(seconds/360)/10, seconds } })
}
export function elapsedTimerSeconds(timer:{elapsedSeconds:number;status:string;runningSince:Date|null}, now:Date){return timer.elapsedSeconds+(timer.status==='running'&&timer.runningSince?Math.max(0,Math.floor((now.getTime()-timer.runningSince.getTime())/1000)):0)}
