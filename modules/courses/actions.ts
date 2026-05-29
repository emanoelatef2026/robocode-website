'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { createCourseSchema, updateCourseSchema } from './schemas'
import type { ActionResult } from '@/types/app'

export async function createCourse(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    title:           formData.get('title'),
    description:     formData.get('description') || undefined,
    category:        formData.get('category') || undefined,
    level:           formData.get('level') || undefined,
    estimated_hours: formData.get('estimated_hours') || undefined,
    scope:           formData.get('scope') || 'branch',
    branch_id:       formData.get('branch_id') || undefined,
    is_published:    formData.get('is_published'),
  }

  const parsed = createCourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Branch ownership: if a branch_id is submitted it must be in the caller's allowed branches
  if (d.branch_id && !isBranchAccessible(user, d.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { data: course, error } = await db
    .from('courses')
    .insert({
      title:           d.title,
      description:     d.description || null,
      category:        d.category || null,
      level:           (d.level || null) as string | null,
      estimated_hours: d.estimated_hours ?? null,
      scope:           d.scope,
      branch_id:       d.branch_id || null,
      is_published:    d.is_published,
      created_by:      user.id,
    })
    .select('id')
    .single()

  if (error || !course) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create course.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'course',
    p_entity_id:    course.id,
    p_new_values:   { title: d.title, scope: d.scope },
  })

  revalidatePath('/admin/courses')
  redirect(`/admin/courses/${course.id}`)
}

export async function updateCourse(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    id:              formData.get('id'),
    title:           formData.get('title'),
    description:     formData.get('description') || undefined,
    category:        formData.get('category') || undefined,
    level:           formData.get('level') || undefined,
    estimated_hours: formData.get('estimated_hours') || undefined,
    scope:           formData.get('scope') || 'branch',
    branch_id:       formData.get('branch_id') || undefined,
    is_published:    formData.get('is_published'),
  }

  const parsed = updateCourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Verify the caller owns the course's current branch before mutating
  const { data: existing } = await db.from('courses').select('branch_id').eq('id', d.id).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Course not found.' } }
  if (existing.branch_id && !isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this course.' } }
  }
  // If the branch is being changed, the new branch must also be accessible
  if (d.branch_id && !isBranchAccessible(user, d.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to the target branch.' } }
  }

  const { error } = await db
    .from('courses')
    .update({
      title:           d.title,
      description:     d.description || null,
      category:        d.category || null,
      level:           (d.level || null) as string | null,
      estimated_hours: d.estimated_hours ?? null,
      scope:           d.scope,
      branch_id:       d.branch_id || null,
      is_published:    d.is_published,
    })
    .eq('id', d.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'course',
    p_entity_id:    d.id,
    p_new_values:   { title: d.title, is_published: d.is_published },
  })

  revalidatePath('/admin/courses')
  revalidatePath(`/admin/courses/${d.id}`)
  return { success: true, data: undefined }
}

export async function deleteCourse(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const { data: existing } = await db.from('courses').select('branch_id').eq('id', id).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Course not found.' } }
  if (existing.branch_id && !isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this course.' } }
  }

  const { error } = await db
    .from('courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'course',
    p_entity_id:    id,
  })

  revalidatePath('/admin/courses')
  return { success: true, data: undefined }
}
