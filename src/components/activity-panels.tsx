import Link from "next/link";
import { duration } from "@/lib/format";
import { addCalendarDays } from "@/lib/time";

type Week = { start: string; seconds: number };
type Subject = {
  id: string;
  name: string;
  slug: string;
  color: string;
  seconds: number;
  percent: number;
};
function label(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function ActivityPanels({
  weekly,
  subjects,
  subjectBase = "/subjects",
}: {
  weekly: Week[];
  subjects: Subject[];
  subjectBase?: string;
}) {
  const max = Math.max(1, ...weekly.map((week) => week.seconds));
  return (
    <div className="activity-panels">
      <section className="activity-panel" aria-labelledby="weekly-title">
        <div className="activity-panel-heading">
          <div>
            <span className="eyebrow">STUDY RHYTHM</span>
            <h3 id="weekly-title">Weekly activity</h3>
            <p>The most recent 12 Monday–Sunday weeks</p>
          </div>
        </div>
        <div className="weekly-rows">
          {weekly.map((week) => (
            <div
              className="weekly-row"
              key={week.start}
              title={`${label(week.start)}–${label(addCalendarDays(week.start, 6))}: ${duration(week.seconds)}`}
            >
              <span className="weekly-label">
                {label(week.start)}–{label(addCalendarDays(week.start, 6))}
              </span>
              <span className="weekly-track">
                <span style={{ width: `${(week.seconds / max) * 100}%` }} />
              </span>
              <strong>{duration(week.seconds)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="activity-panel" aria-labelledby="distribution-title">
        <div className="activity-panel-heading">
          <div>
            <span className="eyebrow">WHERE TIME GOES</span>
            <h3 id="distribution-title">Subject distribution</h3>
          </div>
          <Link href={subjectBase}>View all</Link>
        </div>
        {subjects.length ? (
          <div className="activity-subjects">
            {subjects.map((subject, index) => (
              <div className="activity-subject" key={subject.id}>
                <div className="activity-subject-top">
                  <span className="activity-subject-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="subject-dot"
                    style={{ background: subject.color }}
                  />
                  <Link href={`${subjectBase}/${subject.slug}`}>
                    {subject.name}
                  </Link>
                  <strong>{duration(subject.seconds)}</strong>
                </div>
                <span className="activity-subject-percent">
                  {subject.percent.toFixed(1)}%
                </span>
                <div className="activity-subject-track">
                  <span
                    style={{
                      width: `${subject.percent}%`,
                      background: subject.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="spotify-empty">
            Your subjects will appear here after your first session.
          </div>
        )}
      </section>
    </div>
  );
}
