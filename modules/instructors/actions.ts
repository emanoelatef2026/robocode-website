'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createInstructorSchema, updateInstructorSchema } from './schemas'
import type { ActionResult } from '@/types/app'

function validReturnTo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/admin/') || raw.startsWith('/portal/team-leader/')) return raw
  return null
}

export async function createInstructor(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = {
    email:           formData.get('email'),
    password:        formData.get('password'),
    first_name:      formData.get('first_name'),
    last_name:       formData.get('last_name'),
    branch_id:       formData.get('branch_id'),
    employee_id:     formData.get('employee_id') || undefined,
    hire_date:       formData.get('hire_date') || undefined,
    specializations: formData.get('specializations') || undefined,
  }

  // Validate before the permission check so we can pass branch_id for isolation
  const parsed = createInstructorSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  // CRITICAL-03: enforce branch isolation
  const user = await requirePermission('manage_instructors', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { email, password, first_name, last_name, branch_id, employee_id, hire_date, specializations } = parsed.data
  const specsArray = specializations
    ? specializations.split(',').map((s) => s.trim()).filter(Boolean)
    : []

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

  await db.from('users').upsert({ id: authUserId, email }, { onConflict: 'id' })

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

  const { data: instructor, error: instructorError } = await db
    .from('instructors')
    .insert({
      user_id:         authUserId,
      branch_id,
      employee_id:     employee_id || null,
      hire_date:       hire_date || null,
      status:          'active',
      specializations: specsArray,
    })
    .select('id')
    .single()

  if (instructorError) {
    if (instructorError.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'This instructor is already assigned to this branch.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: instructorError.message } }
  }

  const { data: instructorRole } = await db.from('roles').select('id').eq('name', 'instructor').single()
  if (instructorRole) {
    await db.from('user_roles').upsert(
      { user_id: authUserId, role_id: instructorRole.id, branch_id },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'instructor',
    p_entity_id:    instructor.id,
    p_new_values:   { email, first_name, last_name, branch_id },
    p_branch_id:    branch_id,
  })

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin/instructors')
  revalidatePath('/portal/team-leader/instructors')
  redirect(returnTo ?? '/admin/instructors')
}

export async function updateInstructor(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const raw = {
    id:              formData.get('id'),
    status:          formData.get('status') || undefined,
    employee_id:     formData.get('employee_id') || undefined,
    specializations: formData.get('specializations') || undefined,
  }

  const parsed = updateInstructorSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, status, employee_id, specializations } = parsed.data
  const specsArray = specializations
    ? specializations.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  const updates: Record<string, unknown> = {}
  if (status)                     updates.status          = status
  if (employee_id !== undefined)  updates.employee_id     = employee_id || null
  if (specsArray)                 updates.specializations = specsArray

  const { error } = await db.from('instructors').update(updates).eq('id', id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'instructor',
    p_entity_id:    id,
    p_new_values:   updates,
  })

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin/instructors')
  revalidatePath(`/admin/instructors/${id}`)
  revalidatePath('/portal/team-leader/instructors')
  revalidatePath(`/portal/team-leader/instructors/${id}`)
  redirect(returnTo ?? '/admin/instructors')
}

export async function deleteInstructor(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  // Fetch before deleting so we can revoke the role assignment
  const { data: instructor } = await db
    .from('instructors')
    .select('user_id, branch_id')
    .eq('id', id)
    .single()

  const { error } = await db
    .from('instructors')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // HIGH-03: remove the branch-scoped instructor role so the user loses portal access immediately
  if (instructor) {
    const { data: instructorRole } = await db.from('roles').select('id').eq('name', 'instructor').single()
    if (instructorRole) {
      await db.from('user_roles')
        .delete()
        .eq('user_id', instructor.user_id)
        .eq('role_id', instructorRole.id)
        .eq('branch_id', instructor.branch_id)
    }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'instructor',
    p_entity_id:    id,
  })

  revalidatePath('/admin/instructors')
  return { success: true, data: undefined }
}
