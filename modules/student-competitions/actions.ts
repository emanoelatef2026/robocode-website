'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { resolvePortfolioId } from '@/modules/gamification/achievement-service'
import { logTimelineEvent } from '@/lib/timeline'
import { seedCompetitionResultNotification, seedAchievementEarnedNotification } from '@/modules/notifications/actions'
import { getStudentUserId, getParentUserIdsForStudent } from '@/modules/notifications/queries'
import { createCompetitionSchema, updateCompetitionSchema } from './schemas'
import type { ActionResult } from '@/types/app'

async function notifyCompetitionAudience(competitionId: string, studentId: string, competitionName: string): Promise<void> {
  try {
    const studentUserId = await getStudentUserId(studentId)
    if (studentUserId) await seedCompetitionResultNotification(studentUserId, competitionId, competitionName)

    const parentUserIds = await getParentUserIdsForStudent(studentId)
    await Promise.all(
      parentUserIds.map((pid) => seedCompetitionResultNotification(pid, competitionId, competitionName))
    )
  } catch {
    // non-critical
  }
}

async function notifyAchievementAudience(achievementId: string, studentId: string, title: string): Promise<void> {
  try {
    const studentUserId = await getStudentUserId(studentId)
    if (studentUserId) await seedAchievementEarnedNotification(studentUserId, achievementId, title)
  } catch {
    // non-critical
  }
}

export async function createStudentCompetition(
  input: unknown
): Promise<ActionResult<{ competitionId: string; achievementId: string | null }>> {
  const parsed = createCompetitionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }
  const d = parsed.data
  const db = createServiceClient()

  // Resolve the student's branch for the permission check when the caller didn't pass one.
  let branchId = d.branch_id ?? null
  if (!branchId) {
    const { data: studentRow } = await db.from('students').select('branch_id').eq('id', d.student_id).maybeSingle()
    branchId = (studentRow as any)?.branch_id ?? null
  }

  const user = await requirePermission('manage_competitions', { branchId: branchId ?? undefined })

  const { data: row, error } = await db
    .from('student_competitions')
    .insert({
      student_id:          d.student_id,
      competition_name:    d.competition_name,
      season:              d.season ?? null,
      year:                d.year,
      role:                d.role ?? null,
      team_name:           d.team_name ?? null,
      coach_instructor_id: d.coach_instructor_id ?? null,
      branch_id:           branchId,
      project_id:          d.project_id ?? null,
      rank:                d.rank ?? null,
      award:               d.award ?? null,
      certificate_id:      d.certificate_id ?? null,
      notes:               d.notes ?? null,
      created_by:          user.id,
    })
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to save competition.' } }
  }

  const competitionId = (row as any).id as string
  let achievementId: string | null = null

  // Fold rank/award results into the existing achievement/history system rather
  // than a parallel one — reuses the 'competition' achievement_type already
  // supported by student_achievements.
  if (d.rank || d.award) {
    const portfolioId = await resolvePortfolioId(d.student_id)
    const title = d.award ? `${d.competition_name} — ${d.award}` : `${d.competition_name} — ${d.rank}`

    const { data: achievementRow, error: achErr } = await db
      .from('student_achievements')
      .insert({
        student_id:       d.student_id,
        portfolio_id:     portfolioId,
        title,
        description:      d.notes ?? null,
        achievement_type: 'competition',
        date_awarded:     new Date().toISOString().slice(0, 10),
        competition_id:    competitionId,
        created_by:        user.id,
      })
      .select('id')
      .single()

    if (!achErr && achievementRow) {
      achievementId = (achievementRow as any).id as string
      await db.from('student_competitions').update({ achievement_id: achievementId }).eq('id', competitionId)
      void notifyAchievementAudience(achievementId, d.student_id, title)
      void logTimelineEvent({
        student_id: d.student_id,
        event_type: 'ACHIEVEMENT_EARNED',
        notes:      title,
        created_by: user.id,
        branch_id:  branchId ?? undefined,
      }).catch(() => {})
    }
  }

  void logTimelineEvent({
    student_id: d.student_id,
    event_type: 'COMPETITION_LOGGED',
    notes:      `${d.competition_name}${d.year ? ` (${d.year})` : ''}`,
    created_by: user.id,
    branch_id:  branchId ?? undefined,
  }).catch(() => {})

  void notifyCompetitionAudience(competitionId, d.student_id, d.competition_name)

  return { success: true, data: { competitionId, achievementId } }
}

export async function updateStudentCompetition(input: unknown): Promise<ActionResult<void>> {
  const parsed = updateCompetitionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }
  const d = parsed.data
  const db = createServiceClient()

  const { data: existing } = await db
    .from('student_competitions')
    .select('branch_id')
    .eq('id', d.competition_id)
    .maybeSingle()

  if (!existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Competition not found.' } }
  }

  await requirePermission('manage_competitions', { branchId: (existing as any).branch_id ?? undefined })

  const patch: Record<string, unknown> = {}
  if (d.rank !== undefined)  patch.rank = d.rank
  if (d.award !== undefined) patch.award = d.award
  if (d.notes !== undefined) patch.notes = d.notes

  const { error } = await db.from('student_competitions').update(patch).eq('id', d.competition_id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  return { success: true, data: undefined }
}
