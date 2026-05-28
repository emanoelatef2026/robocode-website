'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createSemesterSchema, updateSemesterSchema, enrollStudentSemesterSchema } from './schemas'
import { checkCertificateEligibility } from '@/modules/progress/eligibility'
import type { ActionResult } from '@/types/app'

const DEFAULT_ORG = 'a0000000-0000-0000-0000-000000000001'

export async function createSemester(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const parsed = createSemesterSchema.safeParse({
    academic_year_id:    formData.get('academic_year_id'),
    name:                formData.get('name'),
    slug:                formData.get('slug'),
    status:              formData.get('status') || 'planned',
    start_date:          formData.get('start_date'),
    end_date:            formData.get('end_date'),
    enrollment_open_at:  formData.get('enrollment_open_at') || undefined,
    enrollment_close_at: formData.get('enrollment_close_at') || undefined,
    max_capacity:        formData.get('max_capacity') || undefined,
    notes:               formData.get('notes') || undefined,
    billing_cycle:       formData.get('billing_cycle') || undefined,
  })

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  if (new Date(d.end_date) <= new Date(d.start_date)) {
    return { success: false, error: { code: 'VALIDATION', message: 'End date must be after start date.' } }
  }

  const { data: semester, error } = await db
    .from('semesters')
    .insert({
      org_id:              DEFAULT_ORG,
      academic_year_id:    d.academic_year_id,
      name:                d.name,
      slug:                d.slug,
      status:              d.status,
      start_date:          d.start_date,
      end_date:            d.end_date,
      enrollment_open_at:  d.enrollment_open_at || null,
      enrollment_close_at: d.enrollment_close_at || null,
      max_capacity:        d.max_capacity ?? null,
      notes:               d.notes || null,
      billing_cycle:       (d.billing_cycle || null) as string | null,
    })
    .select('id')
    .single()

  if (error || !semester) {
    if (error?.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'A semester with this slug already exists.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create semester.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'semester',
    p_entity_id:    semester.id,
    p_new_values:   { name: d.name, status: d.status },
  })

  revalidatePath('/admin/semesters')
  redirect(`/admin/semesters/${semester.id}`)
}

export async function updateSemester(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const parsed = updateSemesterSchema.safeParse({
    id:                  formData.get('id'),
    name:                formData.get('name'),
    slug:                formData.get('slug'),
    status:              formData.get('status') || 'planned',
    start_date:          formData.get('start_date'),
    end_date:            formData.get('end_date'),
    enrollment_open_at:  formData.get('enrollment_open_at') || undefined,
    enrollment_close_at: formData.get('enrollment_close_at') || undefined,
    max_capacity:        formData.get('max_capacity') || undefined,
    notes:               formData.get('notes') || undefined,
    billing_cycle:       formData.get('billing_cycle') || undefined,
  })

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  if (new Date(d.end_date) <= new Date(d.start_date)) {
    return { success: false, error: { code: 'VALIDATION', message: 'End date must be after start date.' } }
  }

  const { error } = await db
    .from('semesters')
    .update({
      name:                d.name,
      slug:                d.slug,
      status:              d.status,
      start_date:          d.start_date,
      end_date:            d.end_date,
      enrollment_open_at:  d.enrollment_open_at || null,
      enrollment_close_at: d.enrollment_close_at || null,
      max_capacity:        d.max_capacity ?? null,
      notes:               d.notes || null,
      billing_cycle:       (d.billing_cycle || null) as string | null,
    })
    .eq('id', d.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'semester',
    p_entity_id:    d.id,
    p_new_values:   { name: d.name, status: d.status },
  })

  revalidatePath('/admin/semesters')
  revalidatePath(`/admin/semesters/${d.id}`)
  return { success: true, data: undefined }
}

export async function deleteSemester(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const { error } = await db.from('semesters').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return { success: false, error: { code: 'CONFLICT', message: 'Cannot delete a semester that has enrolled students. Archive it instead.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'semester',
    p_entity_id:    id,
  })

  revalidatePath('/admin/semesters')
  return { success: true, data: undefined }
}

export async function enrollStudentInSemester(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  const parsed = enrollStudentSemesterSchema.safeParse({
    semester_id: formData.get('semester_id'),
    student_id:  formData.get('student_id'),
    notes:       formData.get('notes') || undefined,
  })

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { semester_id, student_id, notes } = parsed.data

  // Verify semester exists and is enrollable
  const { data: sem } = await db
    .from('semesters')
    .select('id, status, max_capacity')
    .eq('id', semester_id)
    .single()

  if (!sem) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Semester not found.' } }
  }
  if (sem.status === 'completed' || sem.status === 'archived') {
    return { success: false, error: { code: 'VALIDATION', message: 'Cannot enroll in a completed or archived semester.' } }
  }

  // Get student's branch_id
  const { data: student } = await db
    .from('students')
    .select('branch_id')
    .eq('id', student_id)
    .is('deleted_at', null)
    .single()

  if (!student) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  }

  // Check capacity
  if (sem.max_capacity) {
    const { count } = await db
      .from('semester_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('semester_id', semester_id)
      .eq('status', 'enrolled')

    if ((count ?? 0) >= sem.max_capacity) {
      return { success: false, error: { code: 'CONFLICT', message: 'Semester has reached maximum capacity.' } }
    }
  }

  const { error } = await db.from('semester_enrollments').insert({
    semester_id,
    student_id,
    branch_id: student.branch_id,
    status:    'enrolled',
    notes:     notes || null,
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'Student is already enrolled in this semester.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'enroll_student',
    p_entity_type:  'semester',
    p_entity_id:    semester_id,
    p_new_values:   { student_id },
    p_branch_id:    student.branch_id,
  })

  revalidatePath(`/admin/semesters/${semester_id}`)
  return { success: true, data: undefined }
}

export async function dropStudentFromSemester(
  semesterId: string,
  studentId: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  const { error } = await db
    .from('semester_enrollments')
    .update({ status: 'dropped', dropped_at: new Date().toISOString() })
    .eq('semester_id', semesterId)
    .eq('student_id', studentId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'drop_student',
    p_entity_type:  'semester',
    p_entity_id:    semesterId,
    p_new_values:   { student_id: studentId },
  })

  revalidatePath(`/admin/semesters/${semesterId}`)
  return { success: true, data: undefined }
}

export async function closeSemester(
  semesterId: string
): Promise<ActionResult<{ eligible: number; ineligible: number }>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const { data: sem } = await db
    .from('semesters')
    .select('id, status')
    .eq('id', semesterId)
    .single()

  if (!sem) return { success: false, error: { code: 'NOT_FOUND', message: 'Semester not found.' } }
  if (sem.status === 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Semester is already completed.' } }
  }

  // Mark semester completed first so reads reflect the new state
  await db.from('semesters').update({ status: 'completed' }).eq('id', semesterId)

  // Get all enrolled students
  const { data: enrollments } = await db
    .from('semester_enrollments')
    .select('student_id')
    .eq('semester_id', semesterId)
    .eq('status', 'enrolled')

  const studentIds = (enrollments ?? []).map((e: any) => e.student_id as string)

  let eligible   = 0
  let ineligible = 0

  // Evaluate eligibility and update student_course_progress per student
  for (const studentId of studentIds) {
    const result        = await checkCertificateEligibility(studentId, semesterId)
    const progressStatus = result.is_eligible ? 'completed' : 'failed'

    await db
      .from('student_course_progress')
      .update({ status: progressStatus })
      .eq('student_id', studentId)
      .eq('semester_id', semesterId)
      .eq('status', 'active')

    if (result.is_eligible) {
      eligible++
    } else {
      ineligible++
    }
  }

  // Transition all enrolled semester_enrollments to completed
  await db
    .from('semester_enrollments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('semester_id', semesterId)
    .eq('status', 'enrolled')

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'close_semester',
    p_entity_type:  'semester',
    p_entity_id:    semesterId,
    p_new_values:   { eligible, ineligible },
  })

  revalidatePath('/admin/semesters')
  revalidatePath(`/admin/semesters/${semesterId}`)
  return { success: true, data: { eligible, ineligible } }
}

export async function addCourseToSemester(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_curriculum')
  const db   = createServiceClient()

  const semester_id = formData.get('semester_id') as string
  const course_id   = formData.get('course_id') as string

  if (!semester_id || !course_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Semester and course are required.' } }
  }

  const { error } = await db.from('semester_courses').insert({ semester_id, course_id })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'Course is already in this semester.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'add_course',
    p_entity_type:  'semester',
    p_entity_id:    semester_id,
    p_new_values:   { course_id },
  })

  revalidatePath(`/admin/semesters/${semester_id}`)
  return { success: true, data: undefined }
}

export async function removeCourseFromSemester(
  semesterId: string,
  courseId: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_curriculum')
  const db   = createServiceClient()

  const { error } = await db
    .from('semester_courses')
    .delete()
    .eq('semester_id', semesterId)
    .eq('course_id', courseId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'remove_course',
    p_entity_type:  'semester',
    p_entity_id:    semesterId,
    p_new_values:   { course_id: courseId },
  })

  revalidatePath(`/admin/semesters/${semesterId}`)
  return { success: true, data: undefined }
}
