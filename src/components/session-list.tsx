import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { duration } from "@/lib/format";
import { localDay, localLabel } from "@/lib/time";
type Session = {
  id: string;
  title: string;
  notes: string | null;
  startedAt: Date;
  durationSeconds: number;
  subject: { name: string; slug: string; color: string };
};
export function SessionList({
  sessions,
  zone,
  group = true,
  base = "",
}: {
  sessions: Session[];
  zone: string;
  group?: boolean;
  base?: string;
}) {
  if (!sessions.length)
    return (
      <div className="empty-state">
        <Clock3 size={24} />
        <h3>No sessions here yet</h3>
        <p>Study sessions will appear here once they are recorded.</p>
      </div>
    );
  return (
    <div className="session-list">
      {sessions.map((s, index) => {
        const day = localDay(s.startedAt, zone);
        const heading =
          group &&
          (index === 0 ||
            day !== localDay(sessions[index - 1].startedAt, zone));
        return (
          <div key={s.id}>
            {heading && (
              <h3 className="session-date">
                {localLabel(s.startedAt, zone, "EEEE, MMMM d, yyyy")}
              </h3>
            )}
            <article className="session-row">
              <span
                className="subject-dot"
                style={{ background: s.subject.color }}
              />
              <div className="session-copy">
                <h4>{s.title}</h4>
                <div className="session-meta">
                  <Link href={`${base}/subjects/${s.subject.slug}`}>
                    {s.subject.name}
                    <ArrowUpRight size={12} />
                  </Link>
                  <span>·</span>
                  <time dateTime={s.startedAt.toISOString()}>
                    {localLabel(s.startedAt, zone, "h:mm a")}
                  </time>
                </div>
                {s.notes && <p>{s.notes}</p>}
              </div>
              <strong>{duration(s.durationSeconds)}</strong>
            </article>
          </div>
        );
      })}
    </div>
  );
}
