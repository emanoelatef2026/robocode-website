'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createStudentSchema, updateStudentSchema } from './schemas'
import type { ActionResult } from '@/types/app'

export async function createStudent(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    email:           formData.get('email'),
    password:        formData.get('password'),
    first_name:      formData.get('first_name'),
    last_name:       formData.get('last_name'),
    branch_id:       formData.get('branch_id'),
    student_code:    formData.get('student_code') || undefined,
    enrollment_date: formData.get('enrollment_date') || undefined,
    notes:           formData.get('notes') || undefined,
  }

  // Validate before the permission check so we can pass branch_id for isolation
  const parsed = createStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  // CRITICAL-03: enforce branch isolation — non-super_admin cannot create in foreign branches
  const user = await requirePermission('manage_students', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { email, password, first_name, last_name, branch_id, student_code, enrollment_date, notes } = parsed.data

  // 1. Create or find auth user
  let authUserId: string
  const { data: listData } = await db.auth.admin.listUsers({ perPage: 1000 })
  const existing = listData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    authUserId = existing.id
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

  // 2. Ensure public.users row
  await db.from('users').upsert({ id: authUserId, email }, { onConflict: 'id' })

  // 3. Upsert profile
  const { data: existingProfile } = await db
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()

  if (!existingProfile) {
    await db.from('profiles').insert({ user_id: authUserId, first_name, last_name })
  } else {
    await db.from('profiles').update({ first_name, last_name }).eq('user_id', authUserId)
  }

  // 4. Create student record
  const { data: student, error: studentError } = await db
    .from('students')
    .insert({
      user_id:         authUserId,
      branch_id,
      student_code:    student_code || null,
      enrollment_date: enrollment_date || new Date().toISOString().split('T')[0],
      status:          'active',
      notes:           notes || null,
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

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'student',
    p_entity_id:    student.id,
    p_new_values:   { email, first_name, last_name, branch_id },
    p_branch_id:    branch_id,
  })

  revalidatePath('/admin/students')
  redirect('/admin/students')
}

export async function updateStudent(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  const raw = {
    id:           formData.get('id'),
    status:       formData.get('status') || undefined,
    notes:        formData.get('notes') || undefined,
    student_code: formData.get('student_code') || undefined,
  }

  const parsed = updateStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, status, notes, student_code } = parsed.data

  const { data: old } = await db.from('students').select('status, notes').eq('id', id).single()

  const updates: Record<string, unknown> = {}
  if (status)                   updates.status       = status
  if (notes !== undefined)      updates.notes        = notes || null
  if (student_code !== undefined) updates.student_code = student_code || null

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

  revalidatePath('/admin/students')
  revalidatePath(`/admin/students/${id}`)
  redirect('/admin/students')
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
