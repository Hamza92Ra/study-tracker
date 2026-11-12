import { notFound } from "next/navigation";
import Link from "next/link";
import { activityPage, publicOwner } from "@/lib/data";
import { prisma } from "@/lib/db";
import { SessionList } from "@/components/session-list";
import { PublicShell } from "@/components/public-shell";
import { Card } from "@/components/ui/card";
type Params = {
  subject?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: string;
};
export async function PublicActivity({
  searchParams,
  username,
}: {
  searchParams: Promise<Params>;
  username?: string;
}) {
  const q = await searchParams;
  const base = username ? `/u/${username}` : ``;
  const owner = await publicOwner(username);
  if (!owner && username) notFound();
  const zone = owner?.settings?.timezone ?? "Africa/Casablanca";
  const [subjects, result] = owner
    ? await Promise.all([
        prisma.subject.findMany({
          where: { ownerId: owner.id },
          orderBy: { name: "asc" },
        }),
        activityPage(owner.id, zone, { ...q, page: Number(q.page) || 1 }),
      ])
    : [[], { items: [], total: 0, page: 1, pages: 1, pageSize: 10 }];
  const url = (page: number) => {
    const params = new URLSearchParams();
    for (const key of ["subject", "search", "from", "to"] as const)
      if (q[key]) params.set(key, q[key]!);
    params.set("page", String(page));
    return `${base}/activity?${params}`;
  };
  return (
    <PublicShell base={base}>
      <main className="container public-main">
        <span className="eyebrow">Public study log</span>
        <h1 className="page-title">Activity history</h1>
        <p className="page-intro">
          Every published session, newest first. Find a topic or narrow down the
          dates.
        </p>
        <form className="card filter-bar" action={`${base}/activity`}>
          <div className="field">
            <label htmlFor="search">Search titles</label>
            <input
              id="search"
              className="input"
              name="search"
              placeholder="What did you study?"
              defaultValue={q.search || ""}
            />
          </div>
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <select id="subject" name="subject" defaultValue={q.subject || ""}>
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="from">From</label>
            <input
              id="from"
              className="input"
              type="date"
              name="from"
              defaultValue={q.from || ""}
            />
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <input
              id="to"
              className="input"
              type="date"
              name="to"
              defaultValue={q.to || ""}
            />
          </div>
          <button className="button button-primary" type="submit">
            Apply filters
          </button>
          <Link className="button button-secondary" href={`${base}/activity`}>
            Reset
          </Link>
        </form>
        <Card className="panel">
          <div className="panel-head">
            <h3>
              {result.total} {result.total === 1 ? "session" : "sessions"}
            </h3>
            <span className="panel-sub">
              Page {result.page} of {result.pages}
            </span>
          </div>
          <SessionList sessions={result.items} zone={zone} base={base} />
        </Card>
        <div className="pagination">
          <span>
            {result.total
              ? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}`
              : "No results"}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link href={url(result.page - 1)}>Previous</Link>
            )}
            {result.page < result.pages && (
              <Link href={url(result.page + 1)}>Next</Link>
            )}
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
