import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { publicSubjectDistribution } from "@/lib/data";
import { duration } from "@/lib/format";
import { PublicShell } from "@/components/public-shell";
import { SubjectIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
export async function PublicSubjects({ username }: { username?: string } = {}) {
  const base = username ? `/u/${username}` : ``;
  const data = await publicSubjectDistribution(username);
  if (!data && username) notFound();
  const subjects = data?.distribution ?? [];
  return (
    <PublicShell base={base}>
      <main className="container public-main">
        <span className="eyebrow">Learning areas</span>
        <h1 className="page-title">Subjects</h1>
        <p className="page-intro">
          A closer look at the time invested in each subject. Archived subjects
          stay visible when they have history.
        </p>
        <div className="subject-grid">
          {subjects.map((s) => (
            <Link href={`${base}/subjects/${s.slug}`} key={s.id}>
              <Card className="subject-card">
                <div className="subject-card-top">
                  <span
                    className="subject-icon"
                    style={{ background: `${s.color}20`, color: s.color }}
                  >
                    <SubjectIcon name={s.icon} />
                  </span>
                  <ArrowUpRight size={17} />
                </div>
                <h3>{s.name}</h3>
                <p>
                  {s.description ||
                    "A space for focused study and steady progress."}
                </p>
                <div className="subject-card-footer">
                  <strong>{duration(s.seconds)}</strong>
                  <span>
                    {s.count} sessions · {s.percent.toFixed(1)}% of total
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
        {!subjects.length && (
          <Card className="empty-state">
            <h3>No subjects yet</h3>
            <p>Subjects will appear here once the owner adds them.</p>
          </Card>
        )}
      </main>
    </PublicShell>
  );
}
