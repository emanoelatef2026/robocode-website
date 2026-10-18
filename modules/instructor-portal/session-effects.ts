import 'server-only'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAndUnlockAchievements } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { recalculateStudentProgress } from '@/modules/progress/recalculate'
import { checkedEffectsClient } from './session-effects-db'

// Both request work and cron use these same database leases. No detached promises.
export function scheduleSessionEffects(sessionId: string): void {
  after(async () => {
    try { await processSessionEffects(sessionId) }
    catch (error) { console.error('[session-effects] worker failed', error) }
  })
}

export async function processSessionEffects(sessionId: string | null = null, limit = 10): Promise<number> {
  const db = createServiceClient()
  const checked = checkedEffectsClient(db)
  let processed = 0
  for (let i = 0; i < Math.min(Math.max(limit, 1), 50); i++) {
    const { data, error } = await db.rpc('lease_session_effect', { p_session_id: sessionId })
    if (error) throw new Error(error.message)
    const job = data?.[0]
    if (!job) break
    try {
      await checked.rpc('award_session_attendance_xp', {
        p_session_id: job.session_id, p_lease_token: job.lease_token,
      })
      const contexts = await resolveGroupProgressContext(job.group_id, checked, true)
      for (const row of job.attendance as { student_id: string; status: string }[]) {
        if (['present', 'late', 'makeup'].includes(row.status)) {
          await checkAndUnlockAchievements(row.student_id, checked)
          await checkAndAwardBadges(row.student_id, checked)
        }
        for (const ctx of contexts) {
          const result = await recalculateStudentProgress(row.student_id, ctx.courseId, ctx.semesterId, ctx.groupId, checked)
          if (!result.success) throw new Error(result.error.message)
        }
      }
      const result = await checked.rpc('finish_session_effect', {
        p_session_id: job.session_id, p_lease_token: job.lease_token,
      })
      if (result.data !== true) throw new Error('Session effect lease lost')
      processed++
    } catch (error) {
      const result = await db.rpc('fail_session_effect', {
        p_session_id: job.session_id, p_lease_token: job.lease_token,
        p_error: error instanceof Error ? error.message : String(error),
      })
      if (result.error) throw new Error(result.error.message)
      console.error('[session-effects] queued retry', job.session_id, error)
    }
  }
  return processed
}
