'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { logTimelineEvent } from '@/lib/timeline'
import { seedEvaluationPublishedNotification } from '@/modules/notifications/actions'
import { getStudentUserId, getParentUserIdsForStudent } from '@/modules/notifications/queries'
import { createEvaluationSchema, updateEvaluationSchema } from './schemas'
import { EVALUATION_CRITERION_LABELS } from './types'
import type { EvaluationCriterion } from './types'
import type { ActionResult } from '@/types/app'

async function notifyEvaluationAudience(
  evaluationId: string,
  studentId: string,
  criterion: EvaluationCriterion,
  customLabel: string | null | undefined,
  visibleToStudent: boolean,
  visibleToParent: boolean,
): Promise<void> {
  try {
    const label = criterion === 'CUSTOM' ? (customLabel ?? 'Custom') : EVALUATION_CRITERION_LABELS[criterion]
    if (visibleToStudent) {
      const studentUserId = await getStudentUserId(studentId)
      if (studentUserId) await seedEvaluationPublishedNotification(studentUserId, evaluationId, label)
    }
    if (visibleToParent) {
      const parentUserIds = await getParentUserIdsForStudent(studentId)
      await Promise.all(parentUserIds.map((pid) => seedEvaluationPublishedNotification(pid, evaluationId, label)))
    }
  } catch {
    // non-critical
  }
}

export async function createStudentEvaluation(
  input: unknown
): Promise<ActionResult<{ evaluationId: string }>> {
  const parsed = createEvaluationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }
  const d = parsed.data

  const user = await requirePermission('manage_evaluations', { branchId: d.branch_id })
  const db = createServiceClient()

  const { data: row, error } = await db
    .from('student_evaluations')
    .insert({
      student_id:         d.student_id,
      enrollment_id:      d.enrollment_id ?? null,
      course_id:          d.course_id ?? null,
      branch_id:          d.branch_id,
      criterion:          d.criterion,
      custom_label:       d.custom_label ?? null,
      score:              d.score ?? null,
      rating:             d.rating ?? null,
      feedback:           d.feedback ?? null,
      author_id:          user.id,
      visible_to_student: d.visible_to_student,
      visible_to_parent:  d.visible_to_parent,
      evaluated_at:       d.evaluated_at ?? undefined,
    })
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to save evaluation.' } }
  }

  const evaluationId = (row as any).id as string
  const label = d.criterion === 'CUSTOM' ? (d.custom_label ?? 'Custom') : EVALUATION_CRITERION_LABELS[d.criterion as EvaluationCriterion]

  void logTimelineEvent({
    student_id: d.student_id,
    event_type: 'EVALUATION_RECORDED',
    notes:      `${label}${d.score != null ? ` — ${d.score}` : ''}${d.rating != null ? ` — ${d.rating}★` : ''}`,
    created_by: user.id,
    branch_id:  d.branch_id,
  }).catch(() => {})

  void notifyEvaluationAudience(
    evaluationId, d.student_id, d.criterion as EvaluationCriterion, d.custom_label,
    d.visible_to_student, d.visible_to_parent
  )

  return { success: true, data: { evaluationId } }
}

export async function updateStudentEvaluation(input: unknown): Promise<ActionResult<void>> {
  const parsed = updateEvaluationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }
  const d = parsed.data
  const db = createServiceClient()

  const { data: existing } = await db
    .from('student_evaluations')
    .select('branch_id')
    .eq('id', d.evaluation_id)
    .maybeSingle()

  if (!existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Evaluation not found.' } }
  }

  await requirePermission('manage_evaluations', { branchId: (existing as any).branch_id })

  const patch: Record<string, unknown> = {}
  if (d.score !== undefined)              patch.score = d.score
  if (d.rating !== undefined)             patch.rating = d.rating
  if (d.feedback !== undefined)           patch.feedback = d.feedback
  if (d.visible_to_student !== undefined) patch.visible_to_student = d.visible_to_student
  if (d.visible_to_parent !== undefined)  patch.visible_to_parent = d.visible_to_parent

  const { error } = await db.from('student_evaluations').update(patch).eq('id', d.evaluation_id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  return { success: true, data: undefined }
}

// Soft delete — preserves the historical record and audit trail.
export async function deleteStudentEvaluation(evaluationId: string): Promise<ActionResult<void>> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('student_evaluations')
    .select('branch_id')
    .eq('id', evaluationId)
    .maybeSingle()

  if (!existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Evaluation not found.' } }
  }

  await requirePermission('manage_evaluations', { branchId: (existing as any).branch_id })

  const { error } = await db
    .from('student_evaluations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', evaluationId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  return { success: true, data: undefined }
}
