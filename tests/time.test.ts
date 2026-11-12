import { describe, expect, it } from 'vitest'
import { dailyAllocation, elapsedTimerSeconds, goalProgress, localDay, localDayRange, streaks, weeklySeries } from '../src/lib/time'
import { sessionSchema, subjectSchema } from '../src/lib/validation'
const date=(v:string)=>new Date(v)
describe('local calendar aggregation',()=>{
  it('splits a study session at Casablanca midnight across time-zone rule updates',()=>{
    const zone='Africa/Casablanca'
    const midnight=localDayRange('2026-11-10',zone).end
    const startedAt=new Date(midnight.getTime()-1800_000)
    const endedAt=new Date(midnight.getTime()+1800_000)
    expect(localDay(startedAt,zone)).toBe('2026-11-10')
    expect(localDay(endedAt,zone)).toBe('2026-11-11')
    const days=dailyAllocation([{startedAt,endedAt,durationSeconds:3600}],zone)
    expect([...days.values()].reduce((a,b)=>a+b,0)).toBe(3600)
    expect([...days]).toEqual([['2026-11-10',1800],['2026-11-11',1800]])
  })
  it('splits correctly at a DST transition',()=>{const zone='America/New_York';const s={startedAt:date('2026-03-08T04:30:00Z'),endedAt:date('2026-03-08T07:30:00Z'),durationSeconds:10800};const days=dailyAllocation([s],zone);expect(days.get('2026-03-07')).toBe(1800);expect(days.get('2026-03-08')).toBe(9000);expect(localDayRange('2026-03-08',zone).end.getTime()-localDayRange('2026-03-08',zone).start.getTime()).toBe(23*3600_000)})
  it('counts current and longest streaks with a grace day',()=>{const days=new Map([['2026-11-07',3600],['2026-11-08',3600],['2026-11-10',3600]]);expect(streaks(days,'2026-11-11')).toEqual({current:1,longest:2,activeDays:3});expect(streaks(days,'2026-11-12').current).toBe(0)})
  it('uses Monday-to-Sunday weeks, including zero days',()=>{const weeks=weeklySeries(new Map([['2026-11-09',3600]]),'2026-11-11',2);expect(weeks.map(w=>w.start)).toEqual(['2026-11-02','2026-11-09']);expect(weeks.map(w=>w.seconds)).toEqual([0,3600])})
  it('calculates daily and weekly goal progress',()=>{const days=new Map([['2026-11-11',10800],['2026-11-10',7200]]);expect(goalProgress(days,'2026-11-11',180)).toEqual({completed:180,remaining:0,percent:100,weeklyRate:33})})
})
describe('timer and validation',()=>{
  it('keeps elapsed time based on wall clock across refresh',()=>{const state={elapsedSeconds:120,status:'running',runningSince:date('2026-11-11T10:00:00Z')};expect(elapsedTimerSeconds(state,date('2026-11-11T10:05:15Z'))).toBe(435);expect(elapsedTimerSeconds({...state,status:'paused'},date('2026-11-11T15:00:00Z'))).toBe(120)})
  it('rejects invalid session intervals and unsafe subject colors',()=>{expect(sessionSchema.safeParse({subjectId:'x',title:'Test',startedAt:date('2026-11-11T11:00:00Z'),endedAt:date('2026-11-11T10:00:00Z'),isPublic:true}).success).toBe(false);expect(subjectSchema.safeParse({name:'Test',color:'red<script>',icon:'book'}).success).toBe(false)})
})
