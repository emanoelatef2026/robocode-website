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
import { z } from 'zod'
import { queueSessionChange } from '@/modules/instructor-portal/session-changes'

async function notifyEvaluationAudience(
  evaluationId: string,
  studentId: string,
  criterion: EvaluationCriterion,
  customLabel: string | null | undefined,
  visibleToStudent: boolean,
  visibleToParent: boolean,
  summaryLabel?: string,
): Promise<void> {
  try {
    const label = summaryLabel ?? (criterion === 'CUSTOM' ? (customLabel ?? 'Custom') : EVALUATION_CRITERION_LABELS[criterion])
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
  const result = await persistStudentEvaluations([input], false)
  return result.success ? { success: true, data: { evaluationId: result.data.evaluationIds[0] } } : result
}

export async function createStudentEvaluationBatch(inputs: unknown): Promise<ActionResult<{ evaluationIds: string[] }>> {
  return persistStudentEvaluations(inputs, true)
}

async function persistStudentEvaluations(inputs: unknown, batch: boolean): Promise<ActionResult<{ evaluationIds: string[] }>> {
  const parsed = z.array(createEvaluationSchema).min(1).max(14).safeParse(inputs)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }
  const entries = parsed.data
  const d = entries[0]
  if (entries.some(entry => entry.student_id !== d.student_id || entry.branch_id !== d.branch_id || entry.group_id !== d.group_id || entry.course_id !== d.course_id || entry.enrollment_id !== d.enrollment_id || entry.schedule_id !== d.schedule_id)
    || new Set(entries.map(entry => entry.criterion)).size !== entries.length) {
    return { success: false, error: { code: 'VALIDATION', message: 'Use unique criteria for one student and group.' } }
  }

  const user = await requirePermission('manage_evaluations')
  const db = createServiceClient()

  if (user.globalRole === 'instructor') {
    // Assignment permits this group's students, never all students in its branch.
    const forbidden: ActionResult<{ evaluationIds: string[] }> = {
      success: false, error: { code: 'FORBIDDEN', message: 'You cannot evaluate this student in this group.' },
    }
    if (!d.group_id) return forbidden
    const [teacher, group, member] = await Promise.all([
      db.from('instructors').select('id').eq('user_id', user.id).eq('status', 'active').is('deleted_at', null).maybeSingle(),
      db.from('groups').select('branch_id').eq('id', d.group_id).is('deleted_at', null).maybeSingle(),
      db.from('group_students').select('student_id').eq('group_id', d.group_id).eq('student_id', d.student_id).eq('status', 'active').maybeSingle(),
    ])
    if (teacher.error || group.error || member.error || !teacher.data || !group.data || !member.data || group.data.branch_id !== d.branch_id) return forbidden
    const { data: allowed, error: accessError } = await db.rpc('instructor_can_teach_group', {
      p_actor: user.id, p_instructor: teacher.data.id, p_group: d.group_id, p_permission: 'manage_evaluations',
    })
    if (accessError || allowed !== true) return forbidden
    if (d.course_id) {
      const { data, error } = await db.from('group_courses').select('id').eq('group_id', d.group_id).eq('course_id', d.course_id).eq('status', 'active').maybeSingle()
      if (error || !data) return forbidden
    }
    if (d.enrollment_id) {
      const { data, error } = await db.from('student_enrollments').select('id').eq('id', d.enrollment_id).eq('student_id', d.student_id).eq('group_id', d.group_id).maybeSingle()
      if (error || !data) return forbidden
    }
    if (d.schedule_id) {
      if (entries.some(entry => entry.rating == null)) return { success: false, error: { code: 'VALIDATION', message: 'Session evaluations require star ratings.' } }
      const queued = await queueSessionChange(user.id, teacher.data.id, d.schedule_id, d.group_id, 'evaluation', {
        student_id: d.student_id, ratings: entries.map(entry => ({ criterion: entry.criterion, rating: entry.rating })),
        custom_label: d.custom_label, feedback: d.feedback, visible_to_student: d.visible_to_student, visible_to_parent: d.visible_to_parent,
      })
      if (queued) return queued.success ? { success: true, data: { evaluationIds: [queued.data.changeId] } } : queued
    }
  } else {
    await requirePermission('manage_evaluations', { branchId: d.branch_id })
  }

  const payload = entries.map(d => ({
      student_id:         d.student_id,
      group_id:           d.group_id ?? null,
      schedule_id:        d.schedule_id ?? null,
      course_id:          d.course_id ?? null,
      enrollment_id:      d.enrollment_id ?? null,
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
    }))
  const query = db.from('student_evaluations').insert(batch ? payload : payload[0])
  // One multi-row INSERT is atomic: a failed criterion cannot leave a partial evaluation.
  const { data, error } = batch ? await query.select('id, criterion') : await query.select('id, criterion').single()
  const savedRows = Array.isArray(data) ? data : data ? [data] : []

  if (error || savedRows.length !== entries.length) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to save evaluation.' } }
  }

  for (const [index, row] of savedRows.entries()) {
    const d = batch ? entries.find(entry => entry.criterion === row.criterion)! : entries[index]
    const label = d.criterion === 'CUSTOM' ? (d.custom_label ?? 'Custom') : EVALUATION_CRITERION_LABELS[d.criterion as EvaluationCriterion]

    void logTimelineEvent({
      student_id: d.student_id,
      event_type: 'EVALUATION_RECORDED',
      notes:      `${label}${d.score != null ? ` — ${d.score}` : ''}${d.rating != null ? ` — ${d.rating}★` : ''}`,
      created_by: user.id,
      branch_id:  d.branch_id,
    }).catch(() => {})
  }
  // One announcement per submission, rather than one notification for every skill.
  void notifyEvaluationAudience(
    savedRows[0].id, d.student_id, d.criterion as EvaluationCriterion, d.custom_label,
    d.visible_to_student, d.visible_to_parent, batch ? 'Skills evaluation' : undefined,
  )

  return { success: true, data: { evaluationIds: savedRows.map(row => row.id as string) } }
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
