'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { createAssignmentSchema, updateAssignmentSchema } from './schemas'
import type { ActionResult } from '@/types/app'
import type { RubricCriteria } from './types'

export async function createAssignment(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    module_id:            formData.get('module_id'),
    title:                formData.get('title'),
    description:          formData.get('description') || undefined,
    instructions:         formData.get('instructions') || undefined,
    type:                 formData.get('type'),
    submission_type:      formData.get('submission_type') || 'text',
    max_score:            formData.get('max_score') || '100',
    due_at:               formData.get('due_at') || undefined,
    status:               formData.get('status') || 'draft',
    allow_late:           formData.get('allow_late'),
    resubmission_allowed: formData.get('resubmission_allowed'),
    max_resubmissions:    formData.get('max_resubmissions') || '1',
    portfolio_eligible:   formData.get('portfolio_eligible'),
  }

  const parsed = createAssignmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Resolve branch from module → course, then enforce ownership
  const { data: modRow } = await db
    .from('course_modules').select('course_id').eq('id', d.module_id).single()
  if (modRow) {
    const { data: courseRow } = await db
      .from('courses').select('branch_id').eq('id', (modRow as any).course_id).single()
    const branchId = (courseRow as any)?.branch_id
    if (branchId && !isBranchAccessible(user, branchId)) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this course.' } }
    }
  }

  const { data: assignment, error } = await db
    .from('assignments')
    .insert({
      module_id:            d.module_id,
      lesson_id:            null,
      title:                d.title,
      description:          d.description || null,
      instructions:         d.instructions || null,
      type:                 d.type,
      submission_type:      d.submission_type,
      max_score:            d.max_score,
      due_at:               d.due_at || null,
      status:               d.status,
      allow_late:           d.allow_late,
      resubmission_allowed: d.resubmission_allowed,
      max_resubmissions:    d.max_resubmissions,
      portfolio_eligible:   d.portfolio_eligible,
      rubric:               [],
      created_by:           user.id,
    })
    .select('id')
    .single()

  if (error || !assignment) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create assignment.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'assignment',
    p_entity_id:    assignment.id,
    p_new_values:   { title: d.title, type: d.type, status: d.status },
  })

  revalidatePath('/admin/assignments')
  redirect(`/admin/assignments/${assignment.id}`)
}

export async function updateAssignment(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    id:                   formData.get('id'),
    title:                formData.get('title'),
    description:          formData.get('description') || undefined,
    instructions:         formData.get('instructions') || undefined,
    type:                 formData.get('type'),
    submission_type:      formData.get('submission_type'),
    max_score:            formData.get('max_score'),
    due_at:               formData.get('due_at') || undefined,
    status:               formData.get('status'),
    allow_late:           formData.get('allow_late'),
    resubmission_allowed: formData.get('resubmission_allowed'),
    max_resubmissions:    formData.get('max_resubmissions'),
    portfolio_eligible:   formData.get('portfolio_eligible'),
    rubric:               formData.get('rubric') || undefined,
  }

  const parsed = updateAssignmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Resolve branch from assignment → module → course
  const { data: asnRow } = await db
    .from('assignments').select('module_id').eq('id', d.id).single()
  if (asnRow?.module_id) {
    const { data: asnModRow } = await db
      .from('course_modules').select('course_id').eq('id', (asnRow as any).module_id).single()
    if (asnModRow) {
      const { data: asnCourseRow } = await db
        .from('courses').select('branch_id').eq('id', (asnModRow as any).course_id).single()
      const branchId = (asnCourseRow as any)?.branch_id
      if (branchId && !isBranchAccessible(user, branchId)) {
        return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this assignment.' } }
      }
    }
  }

  let rubric: RubricCriteria[] = []
  if (d.rubric) {
    try { rubric = JSON.parse(d.rubric) } catch { /* keep empty */ }
  }

  const { error } = await db
    .from('assignments')
    .update({
      title:                d.title,
      description:          d.description || null,
      instructions:         d.instructions || null,
      type:                 d.type,
      submission_type:      d.submission_type,
      max_score:            d.max_score,
      due_at:               d.due_at || null,
      status:               d.status,
      allow_late:           d.allow_late,
      resubmission_allowed: d.resubmission_allowed,
      max_resubmissions:    d.max_resubmissions,
      portfolio_eligible:   d.portfolio_eligible,
      rubric,
    })
    .eq('id', d.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'assignment',
    p_entity_id:    d.id,
    p_new_values:   { title: d.title, status: d.status },
  })

  revalidatePath('/admin/assignments')
  revalidatePath(`/admin/assignments/${d.id}`)
  return { success: true, data: undefined }
}

export async function deleteAssignment(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  // Resolve branch from assignment → module → course
  const { data: delAsnRow } = await db
    .from('assignments').select('module_id').eq('id', id).single()
  if (delAsnRow?.module_id) {
    const { data: delModRow } = await db
      .from('course_modules').select('course_id').eq('id', (delAsnRow as any).module_id).single()
    if (delModRow) {
      const { data: delCourseRow } = await db
        .from('courses').select('branch_id').eq('id', (delModRow as any).course_id).single()
      const branchId = (delCourseRow as any)?.branch_id
      if (branchId && !isBranchAccessible(user, branchId)) {
        return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this assignment.' } }
      }
    }
  }

  const { error } = await db
    .from('assignments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'assignment',
    p_entity_id:    id,
  })

  revalidatePath('/admin/assignments')
  return { success: true, data: undefined }
}
