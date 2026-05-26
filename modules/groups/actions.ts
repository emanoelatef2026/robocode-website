'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createGroupSchema, updateGroupSchema, enrollStudentSchema } from './schemas'
import type { ActionResult } from '@/types/app'

export async function createGroup(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    branch_id: formData.get('branch_id'),
    name:      formData.get('name'),
    type:      formData.get('type'),
    code:      formData.get('code') || undefined,
    capacity:  formData.get('capacity') || undefined,
  }

  // Validate before permission check so branch_id is available for isolation
  const parsed = createGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  // CRITICAL-03: enforce branch isolation
  const user = await requirePermission('manage_groups', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { branch_id, name, type, code, capacity } = parsed.data

  const { data: group, error } = await db
    .from('groups')
    .insert({
      branch_id,
      name,
      type,
      code:     code || null,
      capacity: capacity ?? null,
      status:   'forming',
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'group',
    p_entity_id:    group.id,
    p_new_values:   { name, type, branch_id },
    p_branch_id:    branch_id,
  })

  revalidatePath('/admin/groups')
  redirect('/admin/groups')
}

export async function updateGroup(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const raw = {
    id:       formData.get('id'),
    name:     formData.get('name'),
    type:     formData.get('type'),
    code:     formData.get('code') || undefined,
    capacity: formData.get('capacity') || undefined,
    status:   formData.get('status') || undefined,
  }

  const parsed = updateGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, name, type, code, capacity, status } = parsed.data

  const updates: Record<string, unknown> = { name, type }
  if (code !== undefined)     updates.code     = code || null
  if (capacity !== undefined) updates.capacity = capacity ?? null
  if (status)                 updates.status   = status

  const { error } = await db.from('groups').update(updates).eq('id', id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'group',
    p_entity_id:    id,
    p_new_values:   updates,
  })

  revalidatePath('/admin/groups')
  revalidatePath(`/admin/groups/${id}`)
  redirect('/admin/groups')
}

export async function deleteGroup(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { error } = await db
    .from('groups')
    .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'group',
    p_entity_id:    id,
  })

  revalidatePath('/admin/groups')
  return { success: true, data: undefined }
}

export async function enrollStudent(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const raw = {
    group_id:   formData.get('group_id'),
    student_id: formData.get('student_id'),
  }

  const parsed = enrollStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { group_id, student_id } = parsed.data

  // HIGH-04: verify student and group belong to the same branch
  const [{ data: group }, { data: student }] = await Promise.all([
    db.from('groups').select('branch_id').eq('id', group_id).is('deleted_at', null).single(),
    db.from('students').select('branch_id').eq('id', student_id).is('deleted_at', null).single(),
  ])

  if (!group || !student) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Group or student not found.' } }
  }

  if (group.branch_id !== student.branch_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Student and group must belong to the same branch.' } }
  }

  // Use INSERT so duplicates surface as an explicit error rather than silently overwriting joined_at
  const { error } = await db.from('group_students').insert({
    group_id,
    student_id,
    status:    'active',
    joined_at: new Date().toISOString(),
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'Student is already enrolled in this group.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'enroll_student',
    p_entity_type:  'group',
    p_entity_id:    group_id,
    p_new_values:   { student_id },
  })

  revalidatePath(`/admin/groups/${group_id}`)
  return { success: true, data: undefined }
}

export async function unenrollStudent(groupId: string, studentId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { error } = await db
    .from('group_students')
    .update({ status: 'dropped', left_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('student_id', studentId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'unenroll_student',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_new_values:   { student_id: studentId },
  })

  revalidatePath(`/admin/groups/${groupId}`)
  return { success: true, data: undefined }
}
