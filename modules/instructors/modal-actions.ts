'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { validatePaymentMethodFields } from '@/modules/instructor-payments/types'
import { getInstructorDetailData, getInstructorFormOptions, listInstructorsOperational } from './operational'
import { computeNextAllocationStart } from '@/modules/academic/session-ownership'
import type {
  InstructorDetailData,
  InstructorFormOptions,
  InstructorOperationalRow,
} from './types'
import type { ActionResult } from '@/types/app'

// ── Data fetching actions (called from client) ────────────────────────────────

export async function getInstructorDetailAction(id: string): Promise<ActionResult<InstructorDetailData>> {
  try {
    const data = await getInstructorDetailData(id)
    if (!data) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
    return { success: true, data }
  } catch (e: unknown) {
    return { success: false, error: { code: 'DB_ERROR', message: e instanceof Error ? e.message : 'Unknown error' } }
  }
}

export async function getFormOptionsAction(branchIds: string[]): Promise<ActionResult<InstructorFormOptions>> {
  try {
    const data = await getInstructorFormOptions(branchIds)
    return { success: true, data }
  } catch (e: unknown) {
    return { success: false, error: { code: 'DB_ERROR', message: e instanceof Error ? e.message : 'Unknown error' } }
  }
}

export async function refreshInstructorListAction(branchIds: string[]): Promise<ActionResult<InstructorOperationalRow[]>> {
  try {
    const data = await listInstructorsOperational(branchIds)
    return { success: true, data }
  } catch (e: unknown) {
    return { success: false, error: { code: 'DB_ERROR', message: e instanceof Error ? e.message : 'Unknown error' } }
  }
}

// ── Create instructor ─────────────────────────────────────────────────────────

export async function createInstructorModalAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const branchIdsRaw  = formData.getAll('branch_ids') as string[]
  const branch_id     = branchIdsRaw[0] ?? (formData.get('branch_id') as string)
  if (!branch_id) return { success: false, error: { code: 'VALIDATION', message: 'At least one branch is required.' } }

  const user = await requirePermission('manage_instructors', { branchId: branch_id })
  const db   = createServiceClient()

  const email      = (formData.get('email') as string)?.trim()
  const password   = formData.get('password') as string
  const first_name = (formData.get('first_name') as string)?.trim()
  const last_name  = (formData.get('last_name') as string)?.trim()

  if (!email || !first_name || !last_name) {
    return { success: false, error: { code: 'VALIDATION', message: 'Name and email are required.' } }
  }
  if (password && password.length < 6) {
    return { success: false, error: { code: 'VALIDATION', message: 'Password must be at least 6 characters.' } }
  }

  const paymentMethod = (formData.get('payment_method') as string) || null
  if (paymentMethod) {
    const validationError = validatePaymentMethodFields({
      payment_method:       paymentMethod,
      wallet_number:        formData.get('wallet_number') as string,
      instapay_number:      formData.get('instapay_number') as string,
      payment_link:         formData.get('payment_link') as string,
      bank_account_number:  formData.get('bank_account_number') as string,
    })
    if (validationError) {
      return { success: false, error: { code: 'VALIDATION', message: validationError } }
    }
  }

  // Auth user
  let authUserId: string
  const { data: listData } = await db.auth.admin.listUsers({ perPage: 1000 })
  const existing = listData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    authUserId = existing.id
  } else {
    if (!password) return { success: false, error: { code: 'VALIDATION', message: 'Password is required for new users.' } }
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createError || !created?.user) {
      return { success: false, error: { code: 'AUTH_ERROR', message: createError?.message ?? 'Failed to create user' } }
    }
    authUserId = created.user.id
  }

  const phone = (formData.get('phone') as string) || null

  await db.from('users').upsert({ id: authUserId, email, phone }, { onConflict: 'id' })

  const { data: existingProfile } = await db.from('profiles').select('id').eq('user_id', authUserId).maybeSingle()
  if (!existingProfile) {
    await db.from('profiles').insert({ user_id: authUserId, first_name, last_name })
  } else {
    await db.from('profiles').update({ first_name, last_name }).eq('user_id', authUserId)
  }

  // Build instructor record
  const specsRaw = formData.get('specializations') as string
  const specializations = specsRaw ? specsRaw.split(',').map(s => s.trim()).filter(Boolean) : []

  const workingDaysRaw = formData.getAll('working_days') as string[]
  const salaryRaw = formData.get('salary_per_session')
  const maxLoadRaw = formData.get('max_weekly_load')

  const instructorInsert: Record<string, unknown> = {
    user_id:         authUserId,
    branch_id,          // primary branch for backward compat
    employee_id:     (formData.get('employee_id') as string) || null,
    hire_date:       (formData.get('hire_date') as string) || null,
    status:          (formData.get('status') as string) || 'active',
    specializations,
    bio:             (formData.get('bio') as string) || null,
    alt_phone:       (formData.get('alt_phone') as string) || null,
    instagram_url:   (formData.get('instagram_url') as string) || null,
    facebook_url:    (formData.get('facebook_url') as string) || null,
    whatsapp_number: (formData.get('whatsapp_number') as string) || null,
    payment_method:      (formData.get('payment_method') as string) || null,
    wallet_number:       (formData.get('wallet_number') as string) || null,
    instapay_number:     (formData.get('instapay_number') as string) || null,
    payment_link:        (formData.get('payment_link') as string) || null,
    bank_account_number: (formData.get('bank_account_number') as string) || null,
    payment_notes:       (formData.get('payment_notes') as string) || null,
    working_days:    workingDaysRaw,
    max_weekly_load: maxLoadRaw ? Number(maxLoadRaw) : null,
    internal_notes:  (formData.get('internal_notes') as string) || null,
    currency:        (formData.get('currency') as string) || 'EGP',
  }
  if (salaryRaw) instructorInsert.salary_per_session = Number(salaryRaw)

  const { data: instructor, error: instructorError } = await db
    .from('instructors')
    .insert(instructorInsert)
    .select('id')
    .single()

  if (instructorError) {
    if (instructorError.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'This instructor already exists in this branch.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: instructorError.message } }
  }

  // Write instructor_branches (multi-branch)
  const allBranchIds = branchIdsRaw.length > 0 ? branchIdsRaw : [branch_id]
  await db.from('instructor_branches').insert(
    allBranchIds.map(bid => ({
      instructor_id: instructor.id,
      branch_id:     bid,
      is_primary:    bid === branch_id,
    }))
  )

  // Assign instructor role
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

  revalidatePath('/portal/team-leader/instructors')
  revalidatePath('/admin/instructors')
  return { success: true, data: { id: instructor.id } }
}

// ── Update instructor ─────────────────────────────────────────────────────────

export async function updateInstructorModalAction(formData: FormData): Promise<ActionResult<void>> {
  const id = formData.get('id') as string
  if (!id) return { success: false, error: { code: 'VALIDATION', message: 'Instructor ID is required.' } }

  const paymentMethod = (formData.get('payment_method') as string) || null
  if (paymentMethod) {
    const validationError = validatePaymentMethodFields({
      payment_method:       paymentMethod,
      wallet_number:        formData.get('wallet_number') as string,
      instapay_number:      formData.get('instapay_number') as string,
      payment_link:         formData.get('payment_link') as string,
      bank_account_number:  formData.get('bank_account_number') as string,
    })
    if (validationError) {
      return { success: false, error: { code: 'VALIDATION', message: validationError } }
    }
  }

  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const { data: instrRow } = await db
    .from('instructors')
    .select('user_id, branch_id')
    .eq('id', id)
    .single()

  if (!instrRow) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instrRow.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  // Sync instructor_branches if branch_ids[] provided
  const branchIdsRaw = formData.getAll('branch_ids') as string[]
  if (branchIdsRaw.length > 0) {
    const primaryBranchId = branchIdsRaw[0]
    await db.from('instructor_branches').delete().eq('instructor_id', id)
    await db.from('instructor_branches').insert(
      branchIdsRaw.map(bid => ({
        instructor_id: id,
        branch_id:     bid,
        is_primary:    bid === primaryBranchId,
      }))
    )
    // Also update primary branch_id on instructor record
    await db.from('instructors').update({ branch_id: primaryBranchId }).eq('id', id)
  }

  // Update profile
  const first_name = (formData.get('first_name') as string)?.trim()
  const last_name  = (formData.get('last_name') as string)?.trim()
  if (first_name || last_name) {
    await db.from('profiles').update({ first_name, last_name }).eq('user_id', instrRow.user_id)
  }

  const phone = formData.get('phone') as string
  if (phone !== null) {
    await db.from('users').update({ phone: phone || null }).eq('id', instrRow.user_id)
  }

  // Update auth email if changed
  const email = (formData.get('email') as string)?.trim()
  if (email) {
    await db.from('users').update({ email }).eq('id', instrRow.user_id)
    await db.auth.admin.updateUserById(instrRow.user_id, { email })
  }

  // Update password if provided
  const password = formData.get('password') as string
  if (password && password.length >= 6) {
    await db.auth.admin.updateUserById(instrRow.user_id, { password })
  }

  const specsRaw = formData.get('specializations') as string
  const specializations = specsRaw ? specsRaw.split(',').map(s => s.trim()).filter(Boolean) : []

  const workingDaysRaw = formData.getAll('working_days') as string[]
  const salaryRaw = formData.get('salary_per_session')
  const maxLoadRaw = formData.get('max_weekly_load')

  const updates: Record<string, unknown> = {
    status:          formData.get('status') || undefined,
    employee_id:     (formData.get('employee_id') as string) || null,
    hire_date:       (formData.get('hire_date') as string) || null,
    specializations,
    bio:             (formData.get('bio') as string) || null,
    alt_phone:       (formData.get('alt_phone') as string) || null,
    instagram_url:   (formData.get('instagram_url') as string) || null,
    facebook_url:    (formData.get('facebook_url') as string) || null,
    whatsapp_number: (formData.get('whatsapp_number') as string) || null,
    payment_method:      (formData.get('payment_method') as string) || null,
    wallet_number:       (formData.get('wallet_number') as string) || null,
    instapay_number:     (formData.get('instapay_number') as string) || null,
    payment_link:        (formData.get('payment_link') as string) || null,
    bank_account_number: (formData.get('bank_account_number') as string) || null,
    payment_notes:       (formData.get('payment_notes') as string) || null,
    working_days:    workingDaysRaw,
    max_weekly_load: maxLoadRaw ? Number(maxLoadRaw) : null,
    internal_notes:  (formData.get('internal_notes') as string) || null,
    currency:        (formData.get('currency') as string) || 'EGP',
  }
  if (salaryRaw) updates.salary_per_session = Number(salaryRaw)
  // Remove undefined values
  Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k])

  const { error } = await db.from('instructors').update(updates).eq('id', id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'instructor',
    p_entity_id:    id,
    p_new_values:   updates,
  })

  revalidatePath('/portal/team-leader/instructors')
  revalidatePath(`/admin/instructors/${id}`)
  return { success: true, data: undefined }
}

// ── Archive / delete instructor ───────────────────────────────────────────────

export async function archiveInstructorAction(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const { data: instr } = await db.from('instructors').select('user_id, branch_id').eq('id', id).single()
  if (!instr) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const { error } = await db.from('instructors')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  const { data: instructorRole } = await db.from('roles').select('id').eq('name', 'instructor').single()
  if (instructorRole) {
    await db.from('user_roles')
      .delete()
      .eq('user_id', instr.user_id)
      .eq('role_id', instructorRole.id)
      .eq('branch_id', instr.branch_id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id, p_action: 'archive',
    p_entity_type: 'instructor', p_entity_id: id,
  })

  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: undefined }
}

// ── Assign group to instructor ────────────────────────────────────────────────

export async function assignGroupModalAction(
  instructorId: string,
  groupId: string,
  role: 'lead' | 'assistant',
  fromSession?: number,
  allocatedSessions?: number,
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const [{ data: instr }, { data: grp }] = await Promise.all([
    db.from('instructors').select('branch_id').eq('id', instructorId).single(),
    db.from('groups').select('branch_id').eq('id', groupId).is('deleted_at', null).single(),
  ])
  if (!instr || !grp) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor or group not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  // Always use the canonical from_session computed from existing allocation ranges.
  // This is immune to cancelled/deleted schedules and guarantees no gaps or overlaps.
  const canonicalFrom = await computeNextAllocationStart(groupId, db)

  const payload: Record<string, unknown> = {
    group_id:      groupId,
    instructor_id: instructorId,
    role,
    from_session:       canonicalFrom,
    allocation_status:  'active',
    assigned_at:        new Date().toISOString(),
    released_at:        null,
  }

  if (allocatedSessions != null) {
    payload.allocated_sessions = allocatedSessions
    payload.to_session         = canonicalFrom + allocatedSessions - 1
  } else {
    payload.allocated_sessions = null
    payload.to_session         = null
  }

  const { error } = await db.from('group_instructors').upsert(
    payload,
    { onConflict: 'group_id,instructor_id', ignoreDuplicates: false }
  )
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  // Ensure instructor_branches has an entry for the group's branch (cross-branch assignment support).
  // is_primary=false so it never overrides the home branch flag.
  await db.from('instructor_branches').upsert(
    { instructor_id: instructorId, branch_id: grp.branch_id, is_primary: false },
    { onConflict: 'instructor_id,branch_id', ignoreDuplicates: true }
  )

  // Sync group_courses.instructor_id
  const { data: gcRows } = await db
    .from('group_courses').select('id, status').eq('group_id', groupId).order('status', { ascending: true })
  const gcStatusRows = (gcRows ?? []) as { id: string; status: string }[]
  const gcRow = gcStatusRows.find(r => r.status === 'active') ?? gcStatusRows[0] ?? null
  if (gcRow) {
    await db.from('group_courses').update({ instructor_id: instructorId }).eq('id', gcRow.id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id, p_action: 'assign_group',
    p_entity_type: 'instructor', p_entity_id: instructorId,
    p_new_values: { group_id: groupId, role, from_session: canonicalFrom, allocated_sessions: allocatedSessions ?? null, to_session: payload.to_session },
  })

  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: undefined }
}

export async function removeGroupModalAction(
  instructorId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const { data: instr } = await db.from('instructors').select('branch_id').eq('id', instructorId).single()
  if (!instr) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  await db.from('group_instructors').delete().eq('instructor_id', instructorId).eq('group_id', groupId)

  const { data: gcRow } = await db
    .from('group_courses').select('id').eq('group_id', groupId).eq('instructor_id', instructorId).maybeSingle()
  if (gcRow) {
    await db.from('group_courses').update({ instructor_id: null }).eq('id', (gcRow as { id: string }).id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id, p_action: 'remove_group',
    p_entity_type: 'instructor', p_entity_id: instructorId,
    p_new_values: { group_id: groupId },
  })

  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: undefined }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function saveNoteAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const instructor_id = formData.get('instructor_id') as string
  const id            = formData.get('id') as string | null
  const content       = (formData.get('content') as string)?.trim()
  const category      = (formData.get('category') as string) || 'general'

  if (!instructor_id || !content) {
    return { success: false, error: { code: 'VALIDATION', message: 'Content is required.' } }
  }

  if (id) {
    const { error } = await db
      .from('instructor_notes')
      .update({ content, category, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('instructor_id', instructor_id)
    if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
    revalidatePath('/portal/team-leader/instructors')
    return { success: true, data: { id } }
  }

  const { data, error } = await db
    .from('instructor_notes')
    .insert({ instructor_id, author_id: user.id, content, category })
    .select('id')
    .single()
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: { id: (data as { id: string }).id } }
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult<void>> {
  await requirePermission('manage_instructors')
  const db = createServiceClient()
  const { error } = await db.from('instructor_notes').delete().eq('id', noteId)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: undefined }
}

// ── Certifications ────────────────────────────────────────────────────────────

export async function saveCertificationAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requirePermission('manage_instructors')
  const db = createServiceClient()

  const instructor_id = formData.get('instructor_id') as string
  const id            = formData.get('id') as string | null
  const certification = formData.get('certification') as string
  const level         = (formData.get('level') as string) || null
  const status        = (formData.get('status') as string) || 'active'
  const issued_at     = (formData.get('issued_at') as string) || null
  const expires_at    = (formData.get('expires_at') as string) || null
  const notes         = (formData.get('notes') as string) || null

  if (!instructor_id || !certification) {
    return { success: false, error: { code: 'VALIDATION', message: 'Certification name is required.' } }
  }

  if (id) {
    const { error } = await db
      .from('instructor_certifications')
      .update({ certification, level, status, issued_at, expires_at, notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('instructor_id', instructor_id)
    if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
    revalidatePath('/portal/team-leader/instructors')
    return { success: true, data: { id } }
  }

  const { data, error } = await db
    .from('instructor_certifications')
    .insert({ instructor_id, certification, level, status, issued_at, expires_at, notes })
    .select('id')
    .single()
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: { id: (data as { id: string }).id } }
}

export async function deleteCertificationAction(certId: string): Promise<ActionResult<void>> {
  await requirePermission('manage_instructors')
  const db = createServiceClient()
  const { error } = await db.from('instructor_certifications').delete().eq('id', certId)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: undefined }
}

// ── Password management ───────────────────────────────────────────────────────

export async function setPasswordAction(instructorId: string, newPassword: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: { code: 'VALIDATION', message: 'Password must be at least 6 characters.' } }
  }

  const { data: instr } = await db.from('instructors').select('branch_id, user_id').eq('id', instructorId).single()
  if (!instr) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const { error } = await db.auth.admin.updateUserById(instr.user_id, { password: newPassword })
  if (error) return { success: false, error: { code: 'AUTH_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/instructors')
  return { success: true, data: undefined }
}

// ── Delete instructor ─────────────────────────────────────────────────────────

export async function deleteInstructorAction(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_instructors')
  const db   = createServiceClient()

  const { data: instr } = await db
    .from('instructors')
    .select('user_id, branch_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!instr) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }
  if (!isBranchAccessible(user, instr.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  // Safety check 1: active groups
  const { data: giRows } = await db
    .from('group_instructors')
    .select('groups!group_instructors_group_id_fkey(status)')
    .eq('instructor_id', id)

  const activeGroupCount = ((giRows ?? []) as unknown as { groups: { status: string } | null }[])
    .filter(r => r.groups?.status === 'active').length

  if (activeGroupCount > 0) {
    return {
      success: false,
      error: {
        code: 'BLOCKED_ACTIVE_GROUPS',
        message: `Cannot delete: instructor has ${activeGroupCount} active group(s). Remove from active groups first, or archive instead.`,
      },
    }
  }

  // Safety check 2: future sessions (via group_courses → schedules)
  const { data: gcRows } = await db
    .from('group_courses')
    .select('id')
    .eq('instructor_id', id)

  const gcIds = ((gcRows ?? []) as { id: string }[]).map(r => r.id)

  if (gcIds.length > 0) {
    const { data: futureSched } = await db
      .from('schedules')
      .select('id')
      .in('group_course_id', gcIds)
      .gt('scheduled_at', new Date().toISOString())
      .neq('status', 'cancelled')
      .limit(1)

    if ((futureSched ?? []).length > 0) {
      return {
        success: false,
        error: {
          code: 'BLOCKED_FUTURE_SESSIONS',
          message: 'Cannot delete: instructor has upcoming sessions scheduled. Cancel them first, or archive instead.',
        },
      }
    }
  }

  // Cleanup relational data
  await db.from('group_instructors').delete().eq('instructor_id', id)
  await db.from('group_courses').update({ instructor_id: null }).eq('instructor_id', id)
  await db.from('instructor_branches').delete().eq('instructor_id', id)
  await db.from('instructor_notes').delete().eq('instructor_id', id)
  await db.from('instructor_certifications').delete().eq('instructor_id', id)

  // Soft delete
  const { error: deleteError } = await db.from('instructors')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (deleteError) {
    return { success: false, error: { code: 'DB_ERROR', message: deleteError.message } }
  }

  // Revoke all instructor roles across all branches
  const { data: instrRole } = await db.from('roles').select('id').eq('name', 'instructor').single()
  if (instrRole) {
    await db.from('user_roles')
      .delete()
      .eq('user_id', instr.user_id)
      .eq('role_id', (instrRole as { id: string }).id)
  }

  // Disable auth user (10-year ban — effectively permanent, preserves audit trail)
  await db.auth.admin.updateUserById(instr.user_id, { ban_duration: '87600h' } as { ban_duration: string })

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'instructor',
    p_entity_id:    id,
    p_new_values:   { deleted: true },
  })

  revalidatePath('/portal/team-leader/instructors')
  revalidatePath('/admin/instructors')
  return { success: true, data: undefined }
}
