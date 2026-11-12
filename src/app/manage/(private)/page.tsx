import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { ownerPage } from "@/lib/owner-page";
import { prisma } from "@/lib/db";
import {
  dailyAllocation,
  goalProgress,
  localDay,
  streaks,
  weeklySeries,
} from "@/lib/time";
import { duration } from "@/lib/format";
import { ManageHeader } from "@/components/manage-header";
import { StudyTimer } from "@/components/timer";
import { SpotifyWidget } from "@/components/spotify-widget";
import { ActivityPanels } from "@/components/activity-panels";
import { SignOut } from "@/components/signout";
import { Card } from "@/components/ui/card";
import { SessionList } from "@/components/session-list";

export default async function Manage({ searchParams }: { searchParams: Promise<{ spotify?: string; spotify_error?: string }> }) {
  const params = await searchParams;
  const owner = await ownerPage();
  const [subjects, sessions, recent, timer, goal, settings, spotifyLinks, spotifyAccount] =
    await Promise.all([
      prisma.subject.findMany({
        where: { ownerId: owner.id },
        orderBy: { name: "asc" },
      }),
      prisma.studySession.findMany({
        where: { ownerId: owner.id },
        select: {
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          subjectId: true,
        },
      }),
      prisma.studySession.findMany({
        where: { ownerId: owner.id },
        include: { subject: true },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      prisma.timerState.findUnique({ where: { ownerId: owner.id } }),
      prisma.studyGoal.findUnique({ where: { ownerId: owner.id } }),
      prisma.userSettings.findUnique({ where: { ownerId: owner.id } }),
      prisma.spotifyLink.findMany({
        where: { ownerId: owner.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, spotifyId: true, label: true },
      }),
      prisma.spotifyAccount.findUnique({
        where: { ownerId: owner.id },
        select: { displayName: true, avatarUrl: true, profileUrl: true },
      }),
    ]);
  const zone = settings?.timezone ?? "Africa/Casablanca";
  const today = localDay(new Date(), zone);
  const days = dailyAllocation(sessions, zone);
  const streak = streaks(days, today);
  const target = goal?.dailyTargetMinutes ?? 180;
  const progress = goalProgress(days, today, target);
  const total = sessions.reduce(
    (sum, session) => sum + session.durationSeconds,
    0,
  );
  const weekly = weeklySeries(days, today);
  const bySubject = new Map<string, { seconds: number; count: number }>();
  for (const session of sessions) {
    const value = bySubject.get(session.subjectId) ?? { seconds: 0, count: 0 };
    value.seconds += session.durationSeconds;
    value.count++;
    bySubject.set(session.subjectId, value);
  }
  const distribution = subjects
    .map((subject) => ({
      ...subject,
      seconds: bySubject.get(subject.id)?.seconds ?? 0,
      count: bySubject.get(subject.id)?.count ?? 0,
      percent: total
        ? ((bySubject.get(subject.id)?.seconds ?? 0) / total) * 100
        : 0,
    }))
    .filter((subject) => !subject.isArchived || subject.count)
    .sort((a, b) => b.seconds - a.seconds);
  return (
    <>
      <ManageHeader
        eyebrow="Your workspace"
        title={`Good to see you, ${owner.displayName.split(" ")[0]}.`}
      >
        <SignOut />
      </ManageHeader>
      <div className="stats-grid mb-5">
        {[
          ["Total study", duration(total)],
          ["Today", duration(days.get(today) ?? 0)],
          ["Current streak", `${streak.current} days`],
          ["Sessions", String(sessions.length)],
        ].map(([label, value]) => (
          <Card className="stat-card" key={label}>
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{value}</strong>
          </Card>
        ))}
      </div>
      <div className="manage-grid">
        <StudyTimer
          initial={timer}
          subjects={subjects
            .filter((subject) => !subject.isArchived)
            .map((subject) => ({ id: subject.id, name: subject.name }))}
        />
        <Card className="manage-card">
          <div className="panel-head">
            <div>
              <h3 className="flex gap-2 items-center">
                <Target size={18} /> Daily goal
              </h3>
              <p className="panel-sub">
                {progress.completed} of {target} minutes today
              </p>
            </div>
            <span className="badge">{progress.percent}%</span>
          </div>
          <div className="mt-12">
            <div className="progress-track">
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="panel-sub mt-3">
              {progress.remaining === 0
                ? "Goal complete. Well done!"
                : `${progress.remaining} minutes remaining`}
            </p>
          </div>
          <div
            className="border-t mt-8 pt-5"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="stat-label">Weekly goal completion</span>
            <strong className="stat-value">{progress.weeklyRate}%</strong>
          </div>
        </Card>
      </div>
      <div className="spotify-area">
        <SpotifyWidget
          links={spotifyLinks}
          selectedId={settings?.selectedSpotifyLinkId ?? null}
          visible={settings?.spotifyWidgetVisible ?? true}
          account={spotifyAccount}
          workspaceId={owner.id}
          accountConnectEnabled={Boolean(process.env.SPOTIFY_CLIENT_ID)}
          connectionNotice={params.spotify === 'connected' ? 'connected' : params.spotify_error}
        />
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your patterns</span>
          <h2>Study rhythm</h2>
        </div>
      </div>
      <ActivityPanels
        weekly={weekly}
        subjects={distribution}
        subjectBase={`/u/${owner.username}/subjects`}
      />
      <div className="section-heading">
        <div>
          <span className="eyebrow">Latest entries</span>
          <h2>Recent sessions</h2>
        </div>
        <Link href="/manage/sessions">
          Manage sessions <ArrowRight size={15} />
        </Link>
      </div>
      <Card className="panel">
        <SessionList
          sessions={recent}
          zone={zone}
          base={`/u/${owner.username}`}
        />
      </Card>
    </>
  );
}
