import { prisma } from "@/lib/db";
import { ownerPage } from "@/lib/owner-page";
import {
  addCalendarDays,
  dailyAllocation,
  goalProgress,
  localDay,
  startOfLocalDay,
  streaks,
  validDay,
  weekStart,
} from "@/lib/time";
import { duration } from "@/lib/format";
import { ManageHeader } from "@/components/manage-header";
import { Card } from "@/components/ui/card";
import { TrendChart, SubjectBarChart } from "@/components/charts";

type Params = { period?: string; from?: string; to?: string };
export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const owner = await ownerPage();
  const q = await searchParams;
  const [settings, goal] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { ownerId: owner.id },
      select: { timezone: true },
    }),
    prisma.studyGoal.findUnique({
      where: { ownerId: owner.id },
      select: { dailyTargetMinutes: true },
    }),
  ]);
  const zone = settings?.timezone ?? "Africa/Casablanca";
  const today = localDay(new Date(), zone);
  const period = ["7d", "30d", "90d", "year", "all", "custom"].includes(
    q.period || "",
  )
    ? q.period!
    : "30d";
  const from =
    period === "7d"
      ? addCalendarDays(today, -6)
      : period === "30d"
        ? addCalendarDays(today, -29)
        : period === "90d"
          ? addCalendarDays(today, -89)
          : period === "year"
            ? `${today.slice(0, 4)}-01-01`
            : period === "custom" && validDay(q.from || "")
              ? q.from!
              : undefined;
  const to = period === "custom" && validDay(q.to || "") ? q.to! : today;
  const sessions =
    from && from > to
      ? []
      : await prisma.studySession.findMany({
          where: {
            ownerId: owner.id,
            ...(from ? { endedAt: { gt: startOfLocalDay(from, zone) } } : {}),
            startedAt: { lt: startOfLocalDay(addCalendarDays(to, 1), zone) },
          },
          select: {
            startedAt: true,
            endedAt: true,
            durationSeconds: true,
            subjectId: true,
            subject: { select: { name: true, color: true } },
          },
          orderBy: { startedAt: "desc" },
        });
  const days = new Map(
    [...dailyAllocation(sessions, zone)].filter(
      ([day]) => (!from || day >= from) && day <= to,
    ),
  );
  const total = [...days.values()].reduce((sum, seconds) => sum + seconds, 0);
  const active = [...days.values()].filter((seconds) => seconds > 0).length;
  const stats = streaks(days, today);
  const subjects = new Map<
    string,
    { name: string; color: string; seconds: number }
  >();
  let longest = 0;
  let sessionCount = 0;
  for (const session of sessions) {
    const seconds = [...dailyAllocation([session], zone)]
      .filter(([day]) => (!from || day >= from) && day <= to)
      .reduce((sum, [, value]) => sum + value, 0);
    if (!seconds) continue;
    sessionCount++;
    longest = Math.max(longest, seconds);
    const current = subjects.get(session.subjectId) ?? {
      name: session.subject.name,
      color: session.subject.color,
      seconds: 0,
    };
    current.seconds += seconds;
    subjects.set(session.subjectId, current);
  }
  const ranked = [...subjects.values()].sort((a, b) => b.seconds - a.seconds);
  const daily = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, seconds]) => ({
      label: day.slice(5),
      hours: Math.round(seconds / 360) / 10,
    }));
  const weeklyMap = new Map<string, number>(),
    monthlyMap = new Map<string, number>();
  for (const [day, seconds] of days) {
    const week = weekStart(day),
      month = day.slice(0, 7);
    weeklyMap.set(week, (weeklyMap.get(week) || 0) + seconds);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + seconds);
  }
  const series = (map: Map<string, number>) =>
    [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, seconds]) => ({
        label,
        hours: Math.round(seconds / 360) / 10,
      }));
  const consistency = goalProgress(
    days,
    today,
    goal?.dailyTargetMinutes || 180,
  );
  const metrics = [
    ["Study time", duration(total)],
    ["Sessions", String(sessionCount)],
    ["Average / active day", active ? duration(total / active) : "0m"],
    ["Most studied", ranked[0]?.name || "—"],
    ["Longest session", duration(longest)],
    ["Current streak", `${stats.current} days`],
    ["Active days", String(active)],
    ["Weekly goal rate", `${consistency.weeklyRate}%`],
  ];
  return (
    <>
      <ManageHeader eyebrow="Your progress" title="Analytics" />
      <form className="card filter-bar" action="/manage/analytics">
        <div className="field">
          <label htmlFor="analytics-period">Time range</label>
          <select id="analytics-period" name="period" defaultValue={period}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="analytics-from">Custom from</label>
          <input
            id="analytics-from"
            className="input"
            type="date"
            name="from"
            defaultValue={q.from || ""}
          />
        </div>
        <div className="field">
          <label htmlFor="analytics-to">Custom to</label>
          <input
            id="analytics-to"
            className="input"
            type="date"
            name="to"
            defaultValue={q.to || ""}
          />
        </div>
        <button className="button button-primary">Apply</button>
      </form>
      <div className="stats-grid">
        {metrics.map(([label, value]) => (
          <Card className="stat-card" key={label}>
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{value}</strong>
          </Card>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Patterns</span>
          <h2>Study over time</h2>
        </div>
      </div>
      <div className="dashboard-grid">
        <Card className="panel">
          <h3>Daily study time</h3>
          <p className="panel-sub">Hours per local calendar day</p>
          <TrendChart data={daily} />
        </Card>
        <Card className="panel">
          <h3>Subject comparison</h3>
          <p className="panel-sub">Hours by learning area</p>
          {ranked.length ? (
            <SubjectBarChart
              data={ranked.map((subject) => ({
                name: subject.name,
                hours: Math.round(subject.seconds / 360) / 10,
                color: subject.color,
              }))}
            />
          ) : (
            <div className="empty-state">No study data in this range.</div>
          )}
        </Card>
      </div>
      <div className="dashboard-grid mt-5">
        <Card className="panel">
          <h3>Weekly trend</h3>
          <TrendChart data={series(weeklyMap)} />
        </Card>
        <Card className="panel">
          <h3>Monthly trend</h3>
          <TrendChart data={series(monthlyMap)} />
        </Card>
      </div>
    </>
  );
}
