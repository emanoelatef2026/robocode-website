'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { generateUniqueLoginEmail, makeEmailLocalPartExists } from '@/lib/generate-login-email'
import { createStudentSchema, updateStudentSchema } from './schemas'
import { resolveGroupCourseId } from '@/modules/academic/enrollment-integrity'
import { reconcileGroupJoin } from '@/modules/enrollments/historical-reconciliation'
import type { ActionResult } from '@/types/app'

function validReturnTo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/admin/') || raw.startsWith('/portal/team-leader/')) return raw
  return null
}

export async function createStudent(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    password:        formData.get('password'),
    first_name:      formData.get('first_name'),
    last_name:       formData.get('last_name'),
    branch_id:       formData.get('branch_id'),
    enrollment_date: formData.get('enrollment_date') || undefined,
    notes:           formData.get('notes') || undefined,
    school_grade:    formData.get('school_grade') || undefined,
    address:         formData.get('address') || undefined,
    phone:           formData.get('phone') || undefined,
    date_of_birth:   formData.get('date_of_birth') || undefined,
    parent_phone_1:  formData.get('parent_phone_1') || undefined,
    parent_phone_2:  formData.get('parent_phone_2') || undefined,
    group_id:        formData.get('group_id') || undefined,
  }

  // Validate before the permission check so we can pass branch_id for isolation
  const parsed = createStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  // CRITICAL-03: enforce branch isolation — non-super_admin cannot create in foreign branches
  const user = await requirePermission('manage_students', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const {
    password, first_name, last_name, branch_id, enrollment_date, notes,
    school_grade, address, phone, date_of_birth, parent_phone_1, parent_phone_2, group_id,
  } = parsed.data

  // 1. Generate a unique @robocodeschools.com login address, then create the auth user
  const email = await generateUniqueLoginEmail('learner', first_name, last_name, makeEmailLocalPartExists(db))

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created?.user) {
    return { success: false, error: { code: 'AUTH_ERROR', message: createError?.message ?? 'Failed to create user' } }
  }
  const authUserId = created.user.id

  // 2. Ensure public.users row (with phone)
  await db.from('users').upsert(
    { id: authUserId, email, phone: phone || null },
    { onConflict: 'id' }
  )

  // 3. Upsert profile (with date_of_birth)
  const profileData: Record<string, unknown> = {
    user_id: authUserId, first_name, last_name,
  }
  if (date_of_birth) profileData.date_of_birth = date_of_birth

  const { data: existingProfile } = await db
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()

  if (!existingProfile) {
    await db.from('profiles').insert(profileData)
  } else {
    await db.from('profiles').update(profileData).eq('user_id', authUserId)
  }

  // 4. Create student record
  const emergencyContact: Record<string, string> = {}
  if (parent_phone_1) emergencyContact.phone1 = parent_phone_1
  if (parent_phone_2) emergencyContact.phone2 = parent_phone_2

  const { data: student, error: studentError } = await db
    .from('students')
    .insert({
      user_id:           authUserId,
      branch_id,
      enrollment_date:   enrollment_date || new Date().toISOString().split('T')[0],
      status:            'active',
      notes:             notes       || null,
      school_grade:      school_grade || null,
      address:           address      || null,
      emergency_contact: emergencyContact,
    })
    .select('id')
    .single()

  if (studentError) {
    if (studentError.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'This student is already enrolled in this branch.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: studentError.message } }
  }

  // 5. Assign student role in this branch
  const { data: studentRole } = await db.from('roles').select('id').eq('name', 'student').single()
  if (studentRole) {
    await db.from('user_roles').upsert(
      { user_id: authUserId, role_id: studentRole.id, branch_id },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  // 6. Optional: enroll in a group
  if (group_id) {
    await db.from('group_students').upsert(
      {
        group_id,
        student_id: student.id,
        enrollment_type: 'primary',
        status: 'active',
        joined_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,student_id', ignoreDuplicates: true }
    )

    // Historical Enrollment Reconciliation: non-fatal flag if this group
    // already has completed sessions.
    const courseId = await resolveGroupCourseId(db, group_id)
    await reconcileGroupJoin({
      db, studentId: student.id, groupId: group_id, courseId, branchId: branch_id, performedBy: user.id,
    })
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'student',
    p_entity_id:    student.id,
    p_new_values:   { email, first_name, last_name, branch_id },
    p_branch_id:    branch_id,
  })

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin/students')
  revalidatePath('/portal/team-leader/students')
  redirect(returnTo ?? '/admin/students')
}

export async function updateStudent(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  const raw = {
    id:             formData.get('id'),
    first_name:     formData.get('first_name')     || undefined,
    last_name:      formData.get('last_name')      || undefined,
    status:         formData.get('status')         || undefined,
    notes:          formData.get('notes')          || undefined,
    school_grade:   formData.get('school_grade')   || undefined,
    address:        formData.get('address')        || undefined,
    phone:          formData.get('phone')          || undefined,
    date_of_birth:  formData.get('date_of_birth')  || undefined,
    parent_phone_1: formData.get('parent_phone_1') || undefined,
    parent_phone_2: formData.get('parent_phone_2') || undefined,
  }

  const parsed = updateStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, first_name, last_name, status, notes, school_grade, address, phone, date_of_birth, parent_phone_1, parent_phone_2 } = parsed.data

  const { data: old } = await db
    .from('students')
    .select('branch_id, status, notes, user_id, emergency_contact')
    .eq('id', id)
    .single()

  if (!old) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  if (!isBranchAccessible(user, old.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  // ── Name update ──
  if (first_name || last_name) {
    const profileUpdate: Record<string, string> = {}
    if (first_name) profileUpdate.first_name = first_name
    if (last_name)  profileUpdate.last_name  = last_name
    await db.from('profiles').update(profileUpdate).eq('user_id', old.user_id)
  }

  // ── Phone + profile ──
  if (phone !== undefined) {
    await db.from('users').update({ phone: phone || null }).eq('id', old.user_id)
  }
  if (date_of_birth !== undefined) {
    await db.from('profiles').update({ date_of_birth: date_of_birth || null }).eq('user_id', old.user_id)
  }

  // ── Emergency contact ──
  const currentEc = (old.emergency_contact as Record<string, string>) ?? {}
  const newEc: Record<string, string> = { ...currentEc }
  if (parent_phone_1 !== undefined) {
    if (parent_phone_1) newEc.phone1 = parent_phone_1; else delete newEc.phone1
  }
  if (parent_phone_2 !== undefined) {
    if (parent_phone_2) newEc.phone2 = parent_phone_2; else delete newEc.phone2
  }

  const updates: Record<string, unknown> = {}
  if (status)                   updates.status            = status
  if (notes !== undefined)      updates.notes             = notes        || null
  if (school_grade !== undefined) updates.school_grade    = school_grade || null
  if (address !== undefined)    updates.address           = address      || null
  if (parent_phone_1 !== undefined || parent_phone_2 !== undefined) {
    updates.emergency_contact = newEc
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await db.from('students').update(updates).eq('id', id)
    if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'student',
    p_entity_id:    id,
    p_old_values:   old ?? null,
    p_new_values:   { ...updates, first_name, last_name },
  })

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin/students')
  revalidatePath(`/admin/students/${id}`)
  revalidatePath('/portal/team-leader/students')
  revalidatePath(`/portal/team-leader/students/${id}`)
  redirect(returnTo ?? '/admin/students')
}

export async function deleteStudent(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  // Fetch before deleting so we can revoke the role assignment
  const { data: student } = await db
    .from('students')
    .select('user_id, branch_id')
    .eq('id', id)
    .single()

  if (!student) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }

  // P6: branch ownership check
  if (!isBranchAccessible(user, student.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { error } = await db
    .from('students')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // HIGH-03: remove the branch-scoped student role so the user loses portal access immediately
  if (student) {
    const { data: studentRole } = await db.from('roles').select('id').eq('name', 'student').single()
    if (studentRole) {
      await db.from('user_roles')
        .delete()
        .eq('user_id', student.user_id)
        .eq('role_id', studentRole.id)
        .eq('branch_id', student.branch_id)
    }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'student',
    p_entity_id:    id,
  })

  revalidatePath('/admin/students')
  return { success: true, data: undefined }
}

// ── Password management ───────────────────────────────────────────────────────

export async function setStudentPassword(
  studentId: string,
  newPassword: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: { code: 'VALIDATION', message: 'Password must be at least 6 characters.' } }
  }

  const { data: student } = await db.from('students').select('branch_id, user_id').eq('id', studentId).single()
  if (!student) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  if (!isBranchAccessible(user, student.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { error } = await db.auth.admin.updateUserById(student.user_id, { password: newPassword })
  if (error) return { success: false, error: { code: 'AUTH_ERROR', message: error.message } }

  // Store plain text for internal ops visibility (intentional — internal system)
  await db.from('students').update({ portal_password: newPassword }).eq('id', studentId)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'set_password',
    p_entity_type:  'student',
    p_entity_id:    studentId,
    p_new_values:   { method: 'direct' },
  })

  return { success: true, data: undefined }
}

// ── Branch transfer ───────────────────────────────────────────────────────────
// All academic history (attendance, assignments, certificates, portfolio) is
// preserved because it is linked by student_id. Only the branch_id field and
// user_roles are updated. Active group memberships are dropped (groups are
// branch-specific); historical records remain.

export async function transferStudentBranch(
  studentId: string,
  newBranchId: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  const { data: student } = await db.from('students').select('branch_id, user_id').eq('id', studentId).single()
  if (!student) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  if (!isBranchAccessible(user, student.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }
  if (!isBranchAccessible(user, newBranchId)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to the target branch.' } }
  }
  if (student.branch_id === newBranchId) {
    return { success: false, error: { code: 'VALIDATION', message: 'Student is already in this branch.' } }
  }

  const oldBranchId = student.branch_id

  // 1. Update student record
  const { error: stuErr } = await db.from('students').update({ branch_id: newBranchId }).eq('id', studentId)
  if (stuErr) return { success: false, error: { code: 'DB_ERROR', message: stuErr.message } }

  // 2. Swap student role to new branch
  const { data: studentRole } = await db.from('roles').select('id').eq('name', 'student').single()
  if (studentRole) {
    await db.from('user_roles')
      .delete()
      .eq('user_id', student.user_id)
      .eq('role_id', studentRole.id)
      .eq('branch_id', oldBranchId)
    await db.from('user_roles').upsert(
      { user_id: student.user_id, role_id: studentRole.id, branch_id: newBranchId },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  // 3. Drop active group memberships (groups belong to the old branch)
  await db.from('group_students')
    .update({ status: 'dropped', left_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('status', 'active')

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'branch_transfer',
    p_entity_type:  'student',
    p_entity_id:    studentId,
    p_old_values:   { branch_id: oldBranchId },
    p_new_values:   { branch_id: newBranchId },
    p_branch_id:    newBranchId,
  })

  revalidatePath('/admin/students')
  revalidatePath(`/admin/students/${studentId}`)
  revalidatePath('/portal/team-leader/students')
  return { success: true, data: undefined }
}
