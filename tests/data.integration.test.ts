import { describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { hashSync } from 'bcryptjs'
const dbTest=process.env.RUN_DB_TESTS==='1'?it:it.skip
describe('database ownership and visibility',()=>{
  dbTest('keeps private sessions out of public history and paginates filters',async()=>{
    config()
    const {prisma}=await import('../src/lib/db') as {prisma:PrismaClient}
    const {activityPage,publicSummary}=await import('../src/lib/data')
    const existingOwner=await prisma.user.findFirst({where:{role:'admin'}})
    const createdOwner=!existingOwner
    const owner=existingOwner??await prisma.user.create({data:{username:`test-${crypto.randomUUID().slice(0,12)}`,email:`test-${crypto.randomUUID().slice(0,12)}@example.test`,displayName:'Integration Test',role:'admin',passwordHash:hashSync(crypto.randomUUID(),10),settings:{create:{timezone:'Africa/Casablanca',profileVisibility:'public'}},goal:{create:{dailyTargetMinutes:180}}}})
    const suffix=crypto.randomUUID().slice(0,8)
    const subject=await prisma.subject.create({data:{ownerId:owner.id,name:`Integration ${suffix}`,slug:`integration-${suffix}`,color:'#638a53',icon:'book'}})
    const base=new Date('2026-09-20T10:00:00Z')
    try{
      for(let i=0;i<3;i++)await prisma.studySession.create({data:{ownerId:owner.id,subjectId:subject.id,title:`Integration session ${suffix} ${i}`,startedAt:new Date(base.getTime()+i*3600000),endedAt:new Date(base.getTime()+(i+1)*3600000),durationSeconds:3600,isPublic:i!==2}})
      const summary=await publicSummary();expect(summary?.sessions.filter(s=>s.subjectId===subject.id)).toHaveLength(2)
      const page1=await activityPage(owner.id,summary!.zone,{subject:subject.slug,search:`Integration session ${suffix}`,page:1,pageSize:1})
      const page2=await activityPage(owner.id,summary!.zone,{subject:subject.slug,search:`Integration session ${suffix}`,page:2,pageSize:1})
      expect(page1.total).toBe(2);expect(page1.pages).toBe(2);expect(page1.items[0].id).not.toBe(page2.items[0].id)
      const privateResults=await activityPage(owner.id,summary!.zone,{subject:subject.slug,search:`Integration session ${suffix} 2`})
      expect(privateResults.total).toBe(0)
      await prisma.subject.update({where:{id:subject.id},data:{isArchived:true}})
      expect((await publicSummary())?.distribution.some(s=>s.id===subject.id)).toBe(true)
      await expect(prisma.subject.delete({where:{id:subject.id}})).rejects.toThrow()
    }finally{await prisma.studySession.deleteMany({where:{subjectId:subject.id}});await prisma.subject.delete({where:{id:subject.id}});if(createdOwner){await prisma.studyGoal.deleteMany({where:{ownerId:owner.id}});await prisma.userSettings.deleteMany({where:{ownerId:owner.id}});await prisma.user.delete({where:{id:owner.id}})}await prisma.$disconnect()}
  })
})
