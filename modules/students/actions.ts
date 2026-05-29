'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { createStudentSchema, updateStudentSchema } from './schemas'
import type { ActionResult } from '@/types/app'

function validReturnTo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/admin/') || raw.startsWith('/portal/team-leader/')) return raw
  return null
}

export async function createStudent(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    email:           formData.get('email'),
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
    email, password, first_name, last_name, branch_id, enrollment_date, notes,
    school_grade, address, phone, date_of_birth, parent_phone_1, parent_phone_2, group_id,
  } = parsed.data

  // 1. Create or find auth user
  let authUserId: string
  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existingUser) {
    authUserId = existingUser.id
  } else {
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created?.user) {
      return { success: false, error: { code: 'AUTH_ERROR', message: createError?.message ?? 'Failed to create user' } }
    }
    authUserId = created.user.id
  }

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
    status:         formData.get('status')        || undefined,
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

  const { id, status, notes, school_grade, address, phone, date_of_birth, parent_phone_1, parent_phone_2 } = parsed.data

  const { data: old } = await db
    .from('students')
    .select('branch_id, status, notes, user_id, emergency_contact')
    .eq('id', id)
    .single()

  if (!old) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }

  if (!isBranchAccessible(user, old.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  // Update users.phone if provided
  if (phone !== undefined) {
    await db.from('users').update({ phone: phone || null }).eq('id', old.user_id)
  }

  // Update profiles.date_of_birth if provided
  if (date_of_birth !== undefined) {
    await db.from('profiles').update({ date_of_birth: date_of_birth || null }).eq('user_id', old.user_id)
  }

  // Build emergency_contact with parent phones
  const currentEc = (old.emergency_contact as Record<string, string>) ?? {}
  const newEc: Record<string, string> = { ...currentEc }
  if (parent_phone_1 !== undefined) {
    if (parent_phone_1) newEc.phone1 = parent_phone_1; else delete newEc.phone1
  }
  if (parent_phone_2 !== undefined) {
    if (parent_phone_2) newEc.phone2 = parent_phone_2; else delete newEc.phone2
  }

  const updates: Record<string, unknown> = {}
  if (status)                updates.status            = status
  if (notes !== undefined)   updates.notes             = notes            || null
  if (school_grade !== undefined) updates.school_grade = school_grade     || null
  if (address !== undefined) updates.address           = address          || null
  if (parent_phone_1 !== undefined || parent_phone_2 !== undefined) {
    updates.emergency_contact = newEc
  }

  const { error } = await db.from('students').update(updates).eq('id', id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'student',
    p_entity_id:    id,
    p_old_values:   old ?? null,
    p_new_values:   updates,
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
