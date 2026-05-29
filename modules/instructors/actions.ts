'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getSupabasePublic } from '@/lib/supabase/server'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { createInstructorSchema, updateInstructorSchema } from './schemas'
import { saveUserPermissions } from '@/modules/user-permissions/mutations'
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
    phone:           formData.get('phone') || undefined,
  }

  // Validate before the permission check so we can pass branch_id for isolation
  const parsed = createInstructorSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  // CRITICAL-03: enforce branch isolation
  const user = await requirePermission('manage_instructors', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { email, password, first_name, last_name, branch_id, employee_id, hire_date, specializations, phone } = parsed.data
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

  await db.from('users').upsert({ id: authUserId, email, phone: phone || null }, { onConflict: 'id' })

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

  // Save per-user permissions
  const grantedPermissions = formData.getAll('permission') as string[]
  await saveUserPermissions(authUserId, user.id, grantedPermissions)

  // Optional: assign instructor to selected groups (same branch)
  const groupIds = formData.getAll('group_ids') as string[]
  for (const groupId of groupIds.filter(Boolean)) {
    await db.from('group_instructors').upsert(
      { group_id: groupId, instructor_id: instructor.id, role: 'lead' },
      { onConflict: 'group_id,instructor_id', ignoreDuplicates: true }
    )
    // Sync group_courses so the instructor portal picks up this group
    const { data: gcRow } = await db
      .from('group_courses').select('id').eq('group_id', groupId).eq('status', 'active').maybeSingle()
    if (gcRow) {
      await db.from('group_courses').update({ instructor_id: instructor.id }).eq('id', (gcRow as any).id)
    }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'instructor',
    p_entity_id:    instructor.id,
    p_new_values:   { email, first_name, last_name, branch_id, groups: groupIds.length },
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
    id:                  formData.get('id'),
    status:              formData.get('status')              || undefined,
    employee_id:         formData.get('employee_id')         || undefined,
    specializations:     formData.get('specializations')     || undefined,
    phone:               formData.get('phone')               || undefined,
    payment_link:        formData.get('payment_link')        || undefined,
    wallet_number:       formData.get('wallet_number')       || undefined,
    bank_account_number: formData.get('bank_account_number') || undefined,
  }

  const parsed = updateInstructorSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, status, employee_id, specializations, phone, payment_link, wallet_number, bank_account_number } = parsed.data
  const specsArray = specializations
    ? specializations.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  // Fetch instructor to verify branch ownership before any mutation
  const { data: instrRow } = await db.from('instructors').select('user_id, branch_id').eq('id', id).single()
  if (!instrRow) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instrRow.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  // Update phone on users table if provided
  if (phone !== undefined && instrRow) {
    await db.from('users').update({ phone: phone || null }).eq('id', instrRow.user_id)
  }

  const updates: Record<string, unknown> = {}
  if (status)                          updates.status              = status
  if (employee_id !== undefined)       updates.employee_id         = employee_id         || null
  if (specsArray)                      updates.specializations     = specsArray
  if (payment_link !== undefined)      updates.payment_link        = payment_link        || null
  if (wallet_number !== undefined)     updates.wallet_number       = wallet_number       || null
  if (bank_account_number !== undefined) updates.bank_account_number = bank_account_number || null

  const { error } = await db.from('instructors').update(updates).eq('id', id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // Save per-user permissions
  if (instrRow) {
    const grantedPermissions = formData.getAll('permission') as string[]
    await saveUserPermissions(instrRow.user_id, user.id, grantedPermissions)
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

  // Fetch before deleting: verify branch ownership AND collect data for role revocation
  const { data: instructor } = await db
    .from('instructors')
    .select('user_id, branch_id')
    .eq('id', id)
    .single()

  if (!instructor) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instructor.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

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

// ── Group assignment ──────────────────────────────────────────────────────────

export async function assignGroupToInstructor(
  instructorId: string,
  groupId: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  // Resolve both entities and verify branch access
  const [{ data: instr }, { data: grp }] = await Promise.all([
    db.from('instructors').select('branch_id').eq('id', instructorId).single(),
    db.from('groups').select('branch_id').eq('id', groupId).is('deleted_at', null).single(),
  ])
  if (!instr || !grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor or group not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }
  if (instr.branch_id !== grp.branch_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Instructor and group must be in the same branch.' } }
  }

  const { error } = await db.from('group_instructors').upsert(
    { group_id: groupId, instructor_id: instructorId, role: 'lead' },
    { onConflict: 'group_id,instructor_id', ignoreDuplicates: true }
  )
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  // Sync group_courses so the instructor portal picks up this group
  const { data: gcRow } = await db
    .from('group_courses').select('id').eq('group_id', groupId).eq('status', 'active').maybeSingle()
  if (gcRow) {
    await db.from('group_courses').update({ instructor_id: instructorId }).eq('id', (gcRow as any).id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'assign_group',
    p_entity_type:  'instructor',
    p_entity_id:    instructorId,
    p_new_values:   { group_id: groupId },
  })

  revalidatePath(`/admin/instructors/${instructorId}`)
  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath('/portal/instructor')
  return { success: true, data: undefined }
}

export async function removeGroupFromInstructor(
  instructorId: string,
  groupId: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const { data: instr } = await db.from('instructors').select('branch_id').eq('id', instructorId).single()
  if (!instr) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { error } = await db.from('group_instructors')
    .delete()
    .eq('instructor_id', instructorId)
    .eq('group_id', groupId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  // Clear group_courses.instructor_id so the instructor portal no longer sees this group
  const { data: gcRow } = await db
    .from('group_courses').select('id').eq('group_id', groupId).eq('instructor_id', instructorId).maybeSingle()
  if (gcRow) {
    await db.from('group_courses').update({ instructor_id: null }).eq('id', (gcRow as any).id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'remove_group',
    p_entity_type:  'instructor',
    p_entity_id:    instructorId,
    p_new_values:   { group_id: groupId },
  })

  revalidatePath(`/admin/instructors/${instructorId}`)
  revalidatePath(`/admin/groups/${groupId}`)
  revalidatePath('/portal/instructor')
  return { success: true, data: undefined }
}

// ── Password management ───────────────────────────────────────────────────────

export async function setInstructorPassword(
  instructorId: string,
  newPassword: string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: { code: 'VALIDATION', message: 'Password must be at least 6 characters.' } }
  }

  const { data: instr } = await db.from('instructors').select('branch_id, user_id').eq('id', instructorId).single()
  if (!instr) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const { error } = await db.auth.admin.updateUserById(instr.user_id, { password: newPassword })
  if (error) return { success: false, error: { code: 'AUTH_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'set_password',
    p_entity_type:  'instructor',
    p_entity_id:    instructorId,
    p_new_values:   { method: 'direct' },
  })

  return { success: true, data: undefined }
}

export async function sendInstructorPasswordReset(instructorId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const { data: instr } = await db
    .from('instructors')
    .select('branch_id, users!instructors_user_id_fkey(email)')
    .eq('id', instructorId)
    .single()
  if (!instr) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, (instr as any).branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const email = (instr as any).users?.email
  if (!email) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor email not found.' } }

  const anon = getSupabasePublic()
  const { error } = await anon.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/reset-password`,
  })
  if (error) return { success: false, error: { code: 'AUTH_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'send_password_reset',
    p_entity_type:  'instructor',
    p_entity_id:    instructorId,
    p_new_values:   { method: 'email', email },
  })

  return { success: true, data: undefined }
}
