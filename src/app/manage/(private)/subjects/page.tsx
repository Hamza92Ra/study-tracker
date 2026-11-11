import { ownerPage } from '@/lib/owner-page'
import { prisma } from '@/lib/db'
import { ManageHeader } from '@/components/manage-header'
import { SubjectManager } from '@/components/subject-manager'
export default async function SubjectsPage(){const owner=await ownerPage();const subjects=await prisma.subject.findMany({where:{ownerId:owner.id},include:{_count:{select:{sessions:true}}},orderBy:[{isArchived:'asc'},{name:'asc'}]});return <><ManageHeader eyebrow="Learning areas" title="Subjects"/><p className="page-intro">Create, organize, and archive study subjects. History is always preserved.</p><SubjectManager subjects={subjects}/></>}
