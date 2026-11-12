import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { publicSubjectDetail } from "@/lib/data";
import { duration } from "@/lib/format";
import { dailyAllocation, localDay, localLabel, weeklySeries } from "@/lib/time";
import { PublicShell } from "@/components/public-shell";
import { SubjectIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { TrendChart } from "@/components/charts";
import { SessionList } from "@/components/session-list";
export async function PublicSubject({
  slug,
  username,
}: {
  slug: string;
  username?: string;
}) {
  const base = username ? `/u/${username}` : ``;
  const data = await publicSubjectDetail(username, slug);
  if (!data) notFound();
  const { subject, sessions } = data;
  const days = dailyAllocation(sessions, data.zone);
  const trend = weeklySeries(days, localDay(new Date(), data.zone));
  return (
    <PublicShell base={base}>
      <main className="container public-main">
        <span className="eyebrow">
          Learning area / {subject.isArchived ? "Archived" : "Active"}
        </span>
        <Card className="subject-hero mt-4">
          <span
            className="subject-icon"
            style={{ background: `${subject.color}20`, color: subject.color }}
          >
            <SubjectIcon name={subject.icon} />
          </span>
          <div>
            <h1>{subject.name}</h1>
            <p>{subject.description || "A dedicated space for learning."}</p>
            <span className="badge">
              Created{" "}
              {localLabel(subject.createdAt, data.zone, "MMMM yyyy")}
            </span>
          </div>
        </Card>
        <div className="stats-grid mt-5">
          {[
            ["Total study time", duration(subject.seconds)],
            ["Sessions", String(subject.count)],
            ["Share of total", `${subject.percent.toFixed(1)}%`],
          ].map(([label, value]) => (
            <Card className="stat-card" key={label}>
              <span className="stat-label">{label}</span>
              <strong className="stat-value">{value}</strong>
            </Card>
          ))}
        </div>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Progress over time</span>
            <h2>Weekly study trend</h2>
          </div>
        </div>
        <Card className="panel">
          <TrendChart data={trend} />
        </Card>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Subject log</span>
            <h2>Recent sessions</h2>
          </div>
          <Link href={`${base}/activity?subject=${subject.slug}`}>
            Full history <ArrowRight size={15} />
          </Link>
        </div>
        <Card className="panel">
          <SessionList
            sessions={sessions.slice(0, 20)}
            zone={data.zone}
            base={base}
          />
        </Card>
      </main>
    </PublicShell>
  );
}
