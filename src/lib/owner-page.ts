import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from './auth'
import { prisma } from './db'
export async function ownerPage(){const session=await getServerSession(authOptions);if(!session?.user?.id)redirect('/manage/login');const owner=await prisma.user.findUnique({where:{id:session.user.id}});if(!owner)redirect('/manage/login');return owner}
