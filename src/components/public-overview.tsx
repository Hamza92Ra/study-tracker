import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { publicSummary } from "@/lib/data";
import { duration, hours, initials } from "@/lib/format";
import { Heatmap } from "@/components/heatmap";
import { ActivityPanels } from "@/components/activity-panels";
import { notFound } from "next/navigation";
import { SessionList } from "@/components/session-list";
import { PublicShell } from "@/components/public-shell";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";

export async function PublicOverview({ username }: { username?: string } = {}) {
  const base = username ? `/u/${username}` : ``;
  const data = await publicSummary(username);
  if (!data && username) notFound();
  if (!data)
    return (
      <PublicShell base={base}>
        <main className="container public-main">
          <div className="hero-card">
            <div className="hero-content">
              <span className="eyebrow">A personal learning journal</span>
              <h1>Progress starts with showing up.</h1>
              <p>The public study profile is not available yet.</p>
            </div>
          </div>
        </main>
      </PublicShell>
    );
  const { owner, sessions, zone, days, today, stats, weekly, distribution } =
    data;
  const statsList = [
    ["Total study time", duration(data.totalSeconds)],
    ["This week", duration(data.thisWeek)],
    ["This month", duration(data.thisMonth)],
    ["Current streak", `${stats.current} days`],
    ["Longest streak", `${stats.longest} days`],
    ["Completed sessions", `${sessions.length}`],
  ];
  return (
    <PublicShell base={base}>
      <main className="container public-main">
        <div className="hero">
          <div className="hero-card">
            <div className="hero-content">
              <span className="eyebrow">The learning journal</span>
              <h1>Every hour adds up, {owner.displayName.split(" ")[0]}.</h1>
              <p>
                {owner.biography ||
                  "A transparent record of curious days, focused sessions, and steady progress."}
              </p>
              <div className="hero-bottom">
                <span className="avatar">
                  {owner.avatarUrl ? (
                    <Image
                      unoptimized
                      src={owner.avatarUrl}
                      alt=""
                      width={34}
                      height={34}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    initials(owner.displayName)
                  )}
                </span>
                <span>
                  {owner.displayName} · {hours(data.totalSeconds)} hours
                  invested
                </span>
              </div>
            </div>
          </div>
          <div className="goal-card">
            <span className="eyebrow">The north star</span>
            <strong>
              {owner.studyGoal || "Keep learning, one day at a time."}
            </strong>
            <p>Small, consistent steps make meaningful progress.</p>
          </div>
        </div>
        <div className="section-heading">
          <div>
            <span className="eyebrow">At a glance</span>
            <h2>Learning in numbers</h2>
          </div>
        </div>
        <div className="stats-grid">
          {statsList.map(([label, value]) => (
            <Reveal key={label}>
              <div className="stat-card">
                <span className="stat-label">{label}</span>
                <strong className="stat-value">{value}</strong>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="section-heading">
          <div>
            <span className="eyebrow">The rhythm</span>
            <h2>How the weeks look</h2>
          </div>
        </div>
        <ActivityPanels
          weekly={weekly}
          subjects={distribution}
          subjectBase={`${base}/subjects`}
        />
        <div className="section-heading">
          <div>
            <span className="eyebrow">Consistency</span>
            <h2>A year of showing up</h2>
            <p>Most recent 365 local calendar days</p>
          </div>
          <span className="panel-sub">
            <Flame size={14} className="inline" /> {stats.activeDays} active
            days
          </span>
        </div>
        <Card className="heatmap-panel">
          <Heatmap days={days} today={today} />
          <p className="panel-sub md:hidden">
            Swipe sideways to explore the full year.
          </p>
          <div className="heatmap-legend">
            Less <span className="heatmap-0" />
            <span className="heatmap-1" />
            <span className="heatmap-2" />
            <span className="heatmap-3" />
            <span className="heatmap-4" /> More
          </div>
        </Card>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Study log</span>
            <h2>Recent activity</h2>
          </div>
          <Link href={`${base}/activity`}>
            Full history <ArrowRight size={15} />
          </Link>
        </div>
        <Card className="panel">
          <SessionList
            sessions={sessions.slice(0, 6)}
            zone={zone}
            base={base}
          />
        </Card>
      </main>
    </PublicShell>
  );
}
