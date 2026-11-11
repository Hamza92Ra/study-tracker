import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
export const dynamic='force-dynamic'
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const base=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000';const owner=await prisma.user.findFirst({include:{settings:true}});const subjects=owner?.settings?.profileVisibility==='private'?[]:await prisma.subject.findMany({where:{ownerId:owner?.id||'',OR:[{isArchived:false},{sessions:{some:{isPublic:true}}}]},select:{slug:true,updatedAt:true}});return [{url:base,lastModified:new Date()},{url:`${base}/activity`,lastModified:new Date()},{url:`${base}/subjects`,lastModified:new Date()},...subjects.map(s=>({url:`${base}/subjects/${s.slug}`,lastModified:s.updatedAt}))]}
