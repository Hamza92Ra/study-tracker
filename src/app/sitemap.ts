import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const users = await prisma.user.findMany({
    where: { isActive: true, settings: { profileVisibility: "public" } },
    select: {
      id: true,
      username: true,
      updatedAt: true,
      subjects: {
        where: {
          OR: [
            { isArchived: false },
            { sessions: { some: { isPublic: true } } },
          ],
        },
        select: { slug: true, updatedAt: true },
      },
    },
  });
  const original = await prisma.user.findFirst({
    where: { role: "admin", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const routes: MetadataRoute.Sitemap = [];
  if (original && users.some((user) => user.id === original.id))
    routes.push(
      { url: base },
      { url: `${base}/activity` },
      { url: `${base}/subjects` },
    );
  for (const user of users) {
    const profile = `${base}/u/${user.username}`;
    routes.push(
      { url: profile, lastModified: user.updatedAt },
      { url: `${profile}/activity`, lastModified: user.updatedAt },
      { url: `${profile}/subjects`, lastModified: user.updatedAt },
    );
    for (const subject of user.subjects)
      routes.push({
        url: `${profile}/subjects/${subject.slug}`,
        lastModified: subject.updatedAt,
      });
    if (user.id === original?.id)
      for (const subject of user.subjects)
        routes.push({
          url: `${base}/subjects/${subject.slug}`,
          lastModified: subject.updatedAt,
        });
  }
  return routes;
}
