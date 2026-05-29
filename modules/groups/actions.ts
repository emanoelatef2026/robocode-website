'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { createGroupSchema, updateGroupSchema, enrollStudentSchema } from './schemas'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import type { ActionResult } from '@/types/app'

function validReturnTo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/admin/') || raw.startsWith('/portal/team-leader/')) return raw
  return null
}

export async function createGroup(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    branch_id:     formData.get('branch_id'),
    name:          formData.get('name'),
    type:          formData.get('type'),
    capacity:      formData.get('capacity') || undefined,
    start_date:    formData.get('start_date') || undefined,
    day_of_week:   formData.get('day_of_week') || undefined,
    time:          formData.get('time') || undefined,
    notes:         formData.get('notes') || undefined,
    instructor_id: formData.get('instructor_id') || undefined,
  }

  const parsed = createGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const user = await requirePermission('manage_groups', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { branch_id, name, type, capacity, start_date, day_of_week, time, notes, instructor_id } = parsed.data

  const { data: group, error } = await db
    .from('groups')
    .insert({
      branch_id,
      name,
      type,
      capacity:    capacity ?? null,
      status:      'forming',
      start_date:  start_date  || null,
      day_of_week: day_of_week || null,
      time:        time        || null,
      notes:       notes       || null,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // Optional: assign lead instructor via group_instructors
  if (instructor_id) {
    await db.from('group_instructors').upsert(
      { group_id: group.id, instructor_id, role: 'lead' },
      { onConflict: 'group_id,instructor_id', ignoreDuplicates: true }
    )
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'group',
    p_entity_id:    group.id,
    p_new_values:   { name, type, branch_id },
    p_branch_id:    branch_id,
  })

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin/groups')
  revalidatePath('/portal/team-leader/groups')
  redirect(returnTo ?? '/admin/groups')
}

export async function updateGroup(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const raw = {
    id:          formData.get('id'),
    name:        formData.get('name'),
    type:        formData.get('type'),
    capacity:    formData.get('capacity') || undefined,
    status:      formData.get('status') || undefined,
    start_date:  formData.get('start_date') || undefined,
    day_of_week: formData.get('day_of_week') || undefined,
    time:        formData.get('time') || undefined,
    notes:       formData.get('notes') || undefined,
  }

  const parsed = updateGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, name, type, capacity, status, start_date, day_of_week, time, notes } = parsed.data

  // P6: branch ownership check
  const { data: existing } = await db.from('groups').select('branch_id').eq('id', id).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const updates: Record<string, unknown> = { name, type }
  if (capacity !== undefined) updates.capacity    = capacity ?? null
  if (status)                 updates.status      = status
  if (start_date  !== undefined) updates.start_date  = start_date  || null
  if (day_of_week !== undefined) updates.day_of_week = day_of_week || null
  if (time        !== undefined) updates.time        = time        || null
  if (notes       !== undefined) updates.notes       = notes       || null

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

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin/groups')
  revalidatePath(`/admin/groups/${id}`)
  revalidatePath('/portal/team-leader/groups')
  revalidatePath(`/portal/team-leader/groups/${id}`)
  redirect(returnTo ?? '/admin/groups')
}

export async function deleteGroup(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  // P6: branch ownership check
  const { data: existing } = await db.from('groups').select('branch_id').eq('id', id).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

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
    group_id:        formData.get('group_id'),
    student_id:      formData.get('student_id'),
    enrollment_type: formData.get('enrollment_type') || 'primary',
  }

  const parsed = enrollStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { group_id, student_id, enrollment_type } = parsed.data

  // Fetch group (branch, capacity, semester) and student (branch) in parallel
  const [{ data: group }, { data: student }] = await Promise.all([
    db.from('groups')
      .select('branch_id, capacity, semester_id')
      .eq('id', group_id)
      .is('deleted_at', null)
      .single(),
    db.from('students')
      .select('branch_id')
      .eq('id', student_id)
      .is('deleted_at', null)
      .single(),
  ])

  if (!group || !student) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Group or student not found.' } }
  }

  // P6: branch ownership check
  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  // Same-branch guard
  if (group.branch_id !== student.branch_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Student and group must belong to the same branch.' } }
  }

  // P2: capacity enforcement
  if (group.capacity !== null) {
    const { count } = await db
      .from('group_students')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group_id)
      .eq('status', 'active')

    if ((count ?? 0) >= group.capacity) {
      return { success: false, error: { code: 'CONFLICT', message: `Group is full (capacity: ${group.capacity}).` } }
    }
  }

  // P4: insert with enrollment_type
  const { error } = await db.from('group_students').insert({
    group_id,
    student_id,
    enrollment_type,
    status:    'active',
    joined_at: new Date().toISOString(),
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'Student is already enrolled in this group.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // P1: create semester_enrollment if group has an active semester
  if (group.semester_id) {
    await db.from('semester_enrollments').insert({
      semester_id: group.semester_id,
      student_id,
      branch_id:   student.branch_id,
      status:      'enrolled',
    })
    // 23505 = already enrolled in this semester — that is fine, do nothing
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'enroll_student',
    p_entity_type:  'group',
    p_entity_id:    group_id,
    p_new_values:   { student_id, enrollment_type },
  })

  const enrollContexts = await resolveGroupProgressContext(group_id)
  if (enrollContexts.length > 0) {
    await safeRecalcProgressBatch(
      buildBatchTuples([student_id], enrollContexts),
      'enrollStudent'
    )
  }

  revalidatePath(`/admin/groups/${group_id}`)
  return { success: true, data: undefined }
}

export async function changeEnrollmentType(
  groupId: string,
  studentId: string,
  enrollmentType: 'primary' | 'secondary'
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: grp } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { error } = await db
    .from('group_students')
    .update({ enrollment_type: enrollmentType })
    .eq('group_id', groupId)
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'change_enrollment_type',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_new_values:   { student_id: studentId, enrollment_type: enrollmentType },
  })

  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath(`/portal/team-leader/groups/${groupId}`)
  return { success: true, data: undefined }
}

export async function bulkEnrollStudents(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ enrolled: number; skipped: number }>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const groupId        = formData.get('group_id') as string
  const enrollmentType = (formData.get('enrollment_type') ?? 'primary') as 'primary' | 'secondary'
  const studentIds     = formData.getAll('student_ids') as string[]

  if (!groupId || studentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'Select at least one student.' } }
  }

  const { data: grp } = await db
    .from('groups').select('branch_id, capacity').eq('id', groupId).is('deleted_at', null).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  if (grp.capacity !== null) {
    const { count: current } = await db
      .from('group_students').select('id', { count: 'exact', head: true })
      .eq('group_id', groupId).eq('status', 'active')
    const available = grp.capacity - (current ?? 0)
    if (studentIds.length > available) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: `Only ${available} slot(s) remaining (capacity: ${grp.capacity}).` },
      }
    }
  }

  let enrolled = 0
  let skipped  = 0
  const enrolledIds: string[] = []
  const now = new Date().toISOString()

  for (const studentId of studentIds) {
    const { error } = await db.from('group_students').insert({
      group_id: groupId,
      student_id: studentId,
      enrollment_type: enrollmentType,
      status:    'active',
      joined_at: now,
    })
    if (error) {
      skipped++
    } else {
      enrolled++
      enrolledIds.push(studentId)
    }
  }

  if (enrolled > 0) {
    await db.rpc('write_audit_log', {
      p_performed_by: user.id,
      p_action:       'bulk_enroll',
      p_entity_type:  'group',
      p_entity_id:    groupId,
      p_new_values:   { enrolled, skipped, enrollment_type: enrollmentType },
    })

    const contexts = await resolveGroupProgressContext(groupId)
    if (contexts.length > 0) {
      await safeRecalcProgressBatch(
        buildBatchTuples(enrolledIds, contexts),
        'bulkEnrollStudents'
      )
    }
  }

  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath(`/portal/team-leader/groups/${groupId}`)
  return { success: true, data: { enrolled, skipped } }
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

  const unenrollContexts = await resolveGroupProgressContext(groupId)
  if (unenrollContexts.length > 0) {
    await safeRecalcProgressBatch(
      buildBatchTuples([studentId], unenrollContexts),
      'unenrollStudent'
    )
  }

  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath(`/portal/team-leader/groups/${groupId}`)
  return { success: true, data: undefined }
}

export async function assignGroupCourse(
  groupId: string,
  courseId: string,
  instructorId: string | null
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  // P6: branch ownership check
  const { data: grp } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  // Deactivate any existing active group_course for this group
  await db.from('group_courses')
    .update({ status: 'cancelled' })
    .eq('group_id', groupId)
    .eq('status', 'active')

  const { data, error } = await db.from('group_courses')
    .insert({
      group_id:      groupId,
      course_id:     courseId,
      instructor_id: instructorId || null,
      status:        'active',
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'assign_course',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_new_values:   { course_id: courseId, instructor_id: instructorId },
  })

  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath(`/portal/team-leader/groups/${groupId}`)
  return { success: true, data: { id: data.id } }
}

export async function assignGroupInstructor(
  groupId: string,
  instructorId: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  // Update the active group_course's instructor
  const { error } = await db.from('group_courses')
    .update({ instructor_id: instructorId })
    .eq('group_id', groupId)
    .eq('status', 'active')

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'assign_instructor',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_new_values:   { instructor_id: instructorId },
  })

  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath(`/portal/team-leader/groups/${groupId}`)
  return { success: true, data: undefined }
}
