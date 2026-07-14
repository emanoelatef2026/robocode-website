'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { createGroupSchema, updateGroupSchema, enrollStudentSchema } from './schemas'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import { syncGroupStatus } from './lifecycle'
import { assignGroupCourseService } from './assignment-service'
import { updateGroupCoursePlan } from './actions/db-ops'
import {
  resolveGroupCourseId,
  closeSameCourseGroupMemberships,
  findActiveEnrollmentForCourse,
} from '@/modules/academic/enrollment-integrity'
import type { ActionResult } from '@/types/app'

function validReturnTo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/admin/') || raw.startsWith('/portal/team-leader/')) return raw
  return null
}

export async function createGroup(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    branch_id:              formData.get('branch_id'),
    name:                   formData.get('name'),
    type:                   formData.get('type'),
    capacity:               formData.get('capacity') || undefined,
    start_date:             formData.get('start_date') || undefined,
    day_of_week:            formData.get('day_of_week') || undefined,
    time:                   formData.get('time') || undefined,
    notes:                  formData.get('notes') || undefined,
    instructor_id:          formData.get('instructor_id') || undefined,
    robocode_share_percent: formData.get('robocode_share_percent') || undefined,
  }

  const parsed = createGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const user = await requirePermission('manage_groups', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { branch_id, name, type, capacity, start_date, day_of_week, time, notes, instructor_id, robocode_share_percent } = parsed.data

  const { data: group, error } = await db
    .from('groups')
    .insert({
      branch_id,
      name,
      type,
      capacity:               capacity ?? null,
      status:                 'forming',
      start_date:             start_date  || null,
      day_of_week:            day_of_week || null,
      time:                   time        || null,
      notes:                  notes       || null,
      robocode_share_percent: robocode_share_percent ?? 100,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

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
    id:                     formData.get('id'),
    name:                   formData.get('name'),
    type:                   formData.get('type'),
    capacity:               formData.get('capacity') || undefined,
    status:                 formData.get('status') || undefined,
    start_date:             formData.get('start_date') || undefined,
    day_of_week:            formData.get('day_of_week') || undefined,
    time:                   formData.get('time') || undefined,
    notes:                  formData.get('notes') || undefined,
    robocode_share_percent: formData.get('robocode_share_percent') || undefined,
  }

  const parsed = updateGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, name, type, capacity, status, start_date, day_of_week, time, notes, robocode_share_percent } = parsed.data

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', id).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const updates: Record<string, unknown> = { name, type }
  if (capacity !== undefined)               updates.capacity               = capacity ?? null
  if (status)                               updates.status                 = status
  if (start_date  !== undefined)            updates.start_date             = start_date  || null
  if (day_of_week !== undefined)            updates.day_of_week            = day_of_week || null
  if (time        !== undefined)            updates.time                   = time        || null
  if (notes       !== undefined)            updates.notes                  = notes       || null
  if (robocode_share_percent !== undefined) updates.robocode_share_percent = robocode_share_percent

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
  redirect(returnTo ?? `/admin/groups/${id}`)
}

export async function deleteGroup(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

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

  const [{ data: group }, { data: student }] = await Promise.all([
    db.from('groups')
      .select('branch_id, capacity')
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

  if (!isBranchAccessible(user, group.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  if (group.branch_id !== student.branch_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Student and group must belong to the same branch.' } }
  }

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

  const today = new Date().toISOString()

  // Same-course-lineage guard: if the student already holds an active
  // membership in a DIFFERENT group teaching the same course, that's a move
  // (e.g. semester rollover) — close it. Different-course memberships (the
  // valid concurrent case, e.g. Python + Robotics) are left untouched.
  const courseId = await resolveGroupCourseId(db, group_id)
  await closeSameCourseGroupMemberships(db, {
    studentId:      student_id,
    courseId,
    excludeGroupId: group_id,
    reason:         `Superseded by move to group ${group_id} (same course).`,
  })

  const { data: gsRow, error } = await db.from('group_students').insert({
    group_id,
    student_id,
    enrollment_type,
    status:    'active',
    joined_at: today,
    course_id: courseId,
  }).select('id').single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'Student is already enrolled in this group.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // ── Dual-write: create student_enrollments record (Sprint 41) ────────────
  // Best-effort — failures are non-fatal to keep backward compatibility.
  // Idempotent: reuses an existing ACTIVE enrollment for this student+course
  // instead of creating a duplicate ledger row.
  try {
    const existingActive = await findActiveEnrollmentForCourse(db, student_id, courseId)
    if (!existingActive) {
      const { data: gcRow } = await db
        .from('group_courses')
        .select('id, instructor_id')
        .eq('group_id', group_id)
        .eq('status', 'active')
        .maybeSingle()

      await db.from('student_enrollments').insert({
        student_id,
        branch_id:       group.branch_id,
        group_id,
        course_id:       courseId,
        group_course_id: (gcRow as any)?.id   ?? null,
        instructor_id:   (gcRow as any)?.instructor_id ?? null,
        group_student_id: (gsRow as any).id,
        start_date:      today.slice(0, 10),
        status:          'ACTIVE',
        enrollment_type,
        created_by:      user.id,
      })
    }
  } catch {
    // Non-fatal: enrollment record will be backfilled by migration if missed
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

  // Students must live in the group's branch
  const { data: candidateStudents } = await db
    .from('students').select('id, student_code, branch_id').in('id', studentIds)
  const wrongBranch = (candidateStudents ?? []).filter(s => s.branch_id !== grp.branch_id)
  if (wrongBranch.length) {
    return {
      success: false,
      error: {
        code: 'VALIDATION',
        message: `Student and group must belong to the same branch. Wrong-branch student(s): ${wrongBranch.map(s => s.student_code ?? s.id).join(', ')}`,
      },
    }
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

  // Resolve the target group's course once — used by the same-course-lineage
  // guard below for every student in this batch.
  const courseId = await resolveGroupCourseId(db, groupId)

  for (const studentId of studentIds) {
    // Close any OTHER active membership this student holds for the SAME
    // course (a move/rollover). Different-course memberships are untouched.
    await closeSameCourseGroupMemberships(db, {
      studentId,
      courseId,
      excludeGroupId: groupId,
      reason:         `Superseded by bulk move to group ${groupId} (same course).`,
    })

    const { error } = await db.from('group_students').insert({
      group_id: groupId,
      student_id: studentId,
      enrollment_type: enrollmentType,
      status:    'active',
      joined_at: now,
      course_id: courseId,
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

  const today = new Date().toISOString()

  const { error } = await db
    .from('group_students')
    .update({ status: 'dropped', left_at: today })
    .eq('group_id', groupId)
    .eq('student_id', studentId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // ── Dual-write: mark enrollment as DROPPED (Sprint 41) ───────────────────
  try {
    await db.from('student_enrollments')
      .update({ status: 'DROPPED', end_date: today.slice(0, 10) })
      .eq('student_id', studentId)
      .eq('group_id', groupId)
      .eq('status', 'ACTIVE')
  } catch {
    // Non-fatal
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

// ── Sprint 22: simplified group configuration save ────────────────────────────
// Handles course, total_sessions, and lead instructor in one atomic operation.
// Course semester and academic period are no longer required for activation.

export async function saveGroupAcademicConfig(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const groupId        = formData.get('group_id')        as string | null
  const courseId       = formData.get('course_id')       as string | null
  const instructorId   = formData.get('instructor_id')   as string | null
  const rawSessions    = formData.get('planned_sessions') as string | null
  const rawOpenEnded   = formData.get('open_ended')      as string | null
  const plannedSessions = rawSessions ? (parseInt(rawSessions, 10) || undefined) : undefined
  const openEnded       = rawOpenEnded === 'true' || rawOpenEnded === 'on'

  if (!groupId) {
    return { success: false, error: { code: 'VALIDATION', message: 'Group ID missing.' } }
  }

  const { data: grp } = await db.from('groups').select('branch_id, status').eq('id', groupId).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  // 1. Course assignment — lifecycle-safe via canonical service
  await assignGroupCourseService(groupId, courseId, instructorId || null, user.id, db)

  // 2. Academic plan — explicit TL-defined session count (no hidden defaults)
  if (courseId) await updateGroupCoursePlan(db, groupId, plannedSessions, openEnded, user.id)

  // 3. Lead instructor — upsert group_instructors with role='lead'
  if (instructorId) {
    await db.from('group_instructors').upsert(
      { group_id: groupId, instructor_id: instructorId, role: 'lead' },
      { onConflict: 'group_id,instructor_id', ignoreDuplicates: false }
    )
  }

  // 4. Auto-sync group status (forming ↔ active)
  await syncGroupStatus(groupId, db)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'save_group_config',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_new_values:   { course_id: courseId, instructor_id: instructorId, planned_sessions: plannedSessions, open_ended: openEnded },
  })

  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath('/admin/groups')
  revalidatePath(`/portal/team-leader/groups/${groupId}`)
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Additional instructor management ──────────────────────────────────────────

export async function addGroupInstructor(
  groupId:      string,
  instructorId: string,
  role:         'lead' | 'additional' = 'additional'
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: grp } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { error } = await db.from('group_instructors').upsert(
    { group_id: groupId, instructor_id: instructorId, role },
    { onConflict: 'group_id,instructor_id' }
  )
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await syncGroupStatus(groupId, db)
  revalidatePath(`/admin/groups/${groupId}`)
  return { success: true, data: undefined }
}

export async function removeGroupInstructor(
  groupId:      string,
  instructorId: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: grp } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { error } = await db.from('group_instructors')
    .delete()
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  // Also clear instructor_id on group_courses if this was the lead
  await db.from('group_courses')
    .update({ instructor_id: null })
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  await syncGroupStatus(groupId, db)
  revalidatePath(`/admin/groups/${groupId}`)
  return { success: true, data: undefined }
}

// ── Legacy schedule management (kept for backward compat) ─────────────────────

const scheduleItemSchema = z.object({
  group_id:         z.string().uuid(),
  scheduled_at:     z.string().min(1, 'Date & time is required'),
  duration_minutes: z.coerce.number().int().min(15).max(480),
  type:             z.enum(['regular', 'makeup', 'exam', 'event']).default('regular'),
  delivery:         z.enum(['online', 'offline', 'hybrid']).optional().or(z.literal('')),
  meeting_url:      z.string().optional().or(z.literal('')),
  room:             z.string().optional().or(z.literal('')),
  topic:            z.string().optional().or(z.literal('')),
})

export async function createGroupSchedule(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const raw = {
    group_id:         formData.get('group_id'),
    scheduled_at:     formData.get('scheduled_at'),
    duration_minutes: formData.get('duration_minutes') ?? 90,
    type:             formData.get('type') || 'regular',
    delivery:         formData.get('delivery') || undefined,
    meeting_url:      formData.get('meeting_url') || undefined,
    room:             formData.get('room') || undefined,
    topic:            formData.get('topic') || undefined,
  }

  const parsed = scheduleItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: grp } = await db.from('groups').select('branch_id').eq('id', d.group_id).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', d.group_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) {
    return { success: false, error: { code: 'VALIDATION', message: 'Assign a course to this group before scheduling sessions.' } }
  }

  const { data: schedule, error } = await db
    .from('schedules')
    .insert({
      group_course_id:  (gcRow as any).id,
      branch_id:        grp.branch_id,
      scheduled_at:     new Date(d.scheduled_at).toISOString(),
      duration_minutes: d.duration_minutes,
      type:             d.type,
      delivery:         d.delivery    || null,
      meeting_url:      d.meeting_url || null,
      room:             d.room        || null,
      topic:            d.topic       || null,
      status:           'scheduled',
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (error || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create schedule.' } }
  }

  revalidatePath(`/admin/groups/${d.group_id}`)
  return { success: true, data: { id: (schedule as any).id } }
}

export async function deleteGroupSchedule(
  scheduleId: string,
  groupId:    string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: sched } = await db
    .from('schedules')
    .select('id, status, branch_id')
    .eq('id', scheduleId)
    .single()

  if (!sched) return { success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found.' } }
  if (!isBranchAccessible(user, (sched as any).branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }
  if ((sched as any).status === 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Cannot delete a completed session.' } }
  }

  const { error } = await db
    .from('schedules')
    .update({ status: 'cancelled' })
    .eq('id', scheduleId)
    .in('status', ['scheduled', 'ongoing'])

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath(`/admin/groups/${groupId}`)
  return { success: true, data: undefined }
}

export async function assignGroupCourse(
  groupId:      string,
  courseId:     string,
  instructorId: string | null
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: grp } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, grp.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  try {
    const result = await assignGroupCourseService(groupId, courseId, instructorId, user.id, db)
    const id = result.action !== 'deactivated' ? result.row.id : groupId

    revalidatePath(`/admin/groups/${groupId}`)
    revalidatePath(`/portal/team-leader/groups/${groupId}`)
    return { success: true, data: { id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Assignment failed.'
    return { success: false, error: { code: 'DB_ERROR', message: msg } }
  }
}
