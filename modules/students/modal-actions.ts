'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { z } from 'zod'
import type { ActionResult } from '@/types/app'

// ── Validation ─────────────────────────────────────────────────────────────────

const guardianSchema = z.object({
  name:               z.string().min(1, 'Guardian name required').max(200),
  relation:           z.enum(['father', 'mother', 'guardian', 'other']).default('guardian'),
  phone1:             z.string().min(7, 'Phone 1 required').max(30),
  phone2:             z.string().max(30).optional().or(z.literal('')),
  whatsapp_preferred: z.boolean().default(false),
  is_primary:         z.boolean().default(false),
  is_emergency:       z.boolean().default(true),
})

const ageSchema = z
  .string()
  .min(1, 'Age is required')
  .transform(v => parseInt(v, 10))
  .pipe(z.number().int().min(3, 'Age must be at least 3').max(25, 'Age must be at most 25'))

const createSchema = z.object({
  email:           z.string().email('Invalid email address'),
  password:        z.string().min(6, 'Password must be at least 6 characters'),
  first_name:      z.string().min(1, 'First name required').max(100),
  last_name:       z.string().min(1, 'Last name required').max(100),
  branch_id:       z.string().uuid('Select a branch'),
  phone:           z.string().min(7, 'Student phone required').max(30),
  age:             ageSchema,
  school_grade:    z.string().max(50).optional().or(z.literal('')),
  date_of_birth:   z.string().optional().or(z.literal('')),
  enrollment_date: z.string().optional().or(z.literal('')),
  notes:           z.string().max(1000).optional().or(z.literal('')),
  guardians_json:  z.string(),
})

const updateSchema = z.object({
  id:             z.string().uuid(),
  first_name:     z.string().min(1).max(100).optional().or(z.literal('')),
  last_name:      z.string().min(1).max(100).optional().or(z.literal('')),
  phone:          z.string().max(30).optional().or(z.literal('')),
  age:            ageSchema.optional().or(z.literal('').transform(() => undefined as unknown as number)),
  school_grade:   z.string().max(50).optional().or(z.literal('')),
  date_of_birth:  z.string().optional().or(z.literal('')),
  status:         z.enum(['active', 'inactive', 'graduated', 'paused', 'banned']).optional(),
  notes:          z.string().max(1000).optional().or(z.literal('')),
  guardians_json: z.string(),
  new_email:      z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : undefined),
    z.string().email('Invalid email address').optional()
  ),
  new_password:   z.preprocess(
    (v) => (typeof v === 'string' && v ? v : undefined),
    z.string().min(6, 'Password must be at least 6 characters').optional()
  ),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseGroupIds(raw: FormDataEntryValue | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw as string)
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : []
  } catch { return [] }
}

async function applyGroupAssignments(
  db: ReturnType<typeof createServiceClient>,
  studentId: string,
  groupsToAdd: string[],
  groupsToRemove: string[]
) {
  const now = new Date().toISOString()

  if (groupsToRemove.length) {
    await db.from('group_students')
      .update({ status: 'dropped', left_at: now })
      .eq('student_id', studentId)
      .in('group_id', groupsToRemove)
      .eq('status', 'active')
  }

  for (const groupId of groupsToAdd) {
    const { data: existing } = await db
      .from('group_students')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (existing) {
      if (existing.status !== 'active') {
        await db.from('group_students').update({ status: 'active', left_at: null }).eq('id', (existing as any).id)
      }
      continue
    }

    // Capacity check — skip if group is full
    const { data: grp } = await db.from('groups').select('capacity').eq('id', groupId).single()
    if ((grp as any)?.capacity) {
      const { count } = await db
        .from('group_students')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('status', 'active')
      if (count !== null && count >= (grp as any).capacity) continue
    }

    await db.from('group_students').insert({
      group_id:        groupId,
      student_id:      studentId,
      enrollment_type: 'primary',
      status:          'active',
      joined_at:       now,
    })
  }
}

type ParsedGuardians =
  | { ok: true;  guardians: z.infer<typeof guardianSchema>[]; error: null }
  | { ok: false; guardians: never[];                          error: string }

function parseGuardians(raw: string): ParsedGuardians {
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return { ok: false, guardians: [], error: 'Invalid guardians data' }
    const result: z.infer<typeof guardianSchema>[] = []
    for (let i = 0; i < arr.length; i++) {
      const r = guardianSchema.safeParse(arr[i])
      if (!r.success) return { ok: false, guardians: [], error: `Guardian ${i + 1}: ${r.error.issues[0].message}` }
      result.push(r.data)
    }
    if (result.length === 0) return { ok: false, guardians: [], error: 'At least one guardian is required' }
    return { ok: true, guardians: result, error: null }
  } catch {
    return { ok: false, guardians: [], error: 'Invalid guardians data' }
  }
}

async function syncGuardians(
  db: ReturnType<typeof createServiceClient>,
  studentId: string,
  guardians: z.infer<typeof guardianSchema>[]
) {
  // Replace all guardians for this student
  await db.from('student_guardians').delete().eq('student_id', studentId)
  if (guardians.length > 0) {
    await db.from('student_guardians').insert(
      guardians.map(g => ({
        student_id:         studentId,
        name:               g.name,
        relation:           g.relation,
        phone1:             g.phone1 || null,
        phone2:             g.phone2 || null,
        whatsapp_preferred: g.whatsapp_preferred,
        is_primary:         g.is_primary,
        is_emergency:       g.is_emergency,
      }))
    )
  }

  // Keep emergency_contact JSONB in sync for backward compat
  const primary = guardians.find(g => g.is_primary) ?? guardians[0]
  if (primary) {
    const ec: Record<string, string> = {}
    if (primary.name)   ec.name   = primary.name
    if (primary.phone1) ec.phone1 = primary.phone1
    if (primary.phone2) ec.phone2 = primary.phone2
    await db.from('students').update({ emergency_contact: ec }).eq('id', studentId)
  }
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createStudentModal(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    email:           formData.get('email'),
    password:        formData.get('password'),
    first_name:      formData.get('first_name'),
    last_name:       formData.get('last_name'),
    branch_id:       formData.get('branch_id'),
    phone:           formData.get('phone') || undefined,
    age:             formData.get('age') || '',
    school_grade:    formData.get('school_grade') || undefined,
    date_of_birth:   formData.get('date_of_birth') || undefined,
    enrollment_date: formData.get('enrollment_date') || undefined,
    notes:           formData.get('notes') || undefined,
    guardians_json:  formData.get('guardians_json') || '[]',
  }

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const guardianResult = parseGuardians(parsed.data.guardians_json)
  if (!guardianResult.ok) {
    return { success: false, error: { code: 'VALIDATION', message: guardianResult.error! } }
  }

  const user = await requirePermission('manage_students', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { email, password, first_name, last_name, branch_id, phone, age, school_grade, date_of_birth, enrollment_date, notes } = parsed.data

  // 1. Auth user
  let authUserId: string
  const { data: existing } = await db.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle()
  if (existing) {
    authUserId = existing.id
  } else {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createErr || !created?.user) {
      return { success: false, error: { code: 'AUTH_ERROR', message: createErr?.message ?? 'Failed to create user' } }
    }
    authUserId = created.user.id
  }

  // 2. users row
  await db.from('users').upsert({ id: authUserId, email, phone: phone || null }, { onConflict: 'id' })

  // 3. profile (with optional date_of_birth)
  const { data: existingProf } = await db.from('profiles').select('id').eq('user_id', authUserId).maybeSingle()
  const profileData: Record<string, unknown> = { user_id: authUserId, first_name, last_name }
  if (date_of_birth) profileData.date_of_birth = date_of_birth
  if (!existingProf) await db.from('profiles').insert(profileData)
  else               await db.from('profiles').update(profileData).eq('user_id', authUserId)

  // 4. Build legacy emergency_contact from primary guardian
  const primaryG  = guardianResult.guardians.find(g => g.is_primary) ?? guardianResult.guardians[0]
  const emergencyContact: Record<string, string> = {}
  if (primaryG?.name)   emergencyContact.name   = primaryG.name
  if (primaryG?.phone1) emergencyContact.phone1 = primaryG.phone1
  if (primaryG?.phone2) emergencyContact.phone2 = primaryG.phone2

  // 5. Student record (with required age)
  const { data: student, error: stuErr } = await db
    .from('students')
    .insert({
      user_id:           authUserId,
      branch_id,
      enrollment_date:   enrollment_date || new Date().toISOString().split('T')[0],
      status:            'active',
      age,
      notes:             notes || null,
      school_grade:      school_grade || null,
      emergency_contact: emergencyContact,
    })
    .select('id')
    .single()

  if (stuErr) {
    if (stuErr.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'This student is already enrolled in this branch.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: stuErr.message } }
  }

  // 6. Student role
  const { data: studentRole } = await db.from('roles').select('id').eq('name', 'student').single()
  if (studentRole) {
    await db.from('user_roles').upsert(
      { user_id: authUserId, role_id: studentRole.id, branch_id },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  // 7. Guardians
  await syncGuardians(db, student.id, guardianResult.guardians)

  // 8. Group assignments
  const groupsToAdd = parseGroupIds(formData.get('groups_to_add_json'))
  if (groupsToAdd.length) {
    await applyGroupAssignments(db, student.id, groupsToAdd, [])
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'student',
    p_entity_id:    student.id,
    p_new_values:   { email, first_name, last_name, branch_id },
    p_branch_id:    branch_id,
  })

  revalidatePath('/portal/team-leader/students')
  revalidatePath('/admin/students')
  return { success: true, data: { id: student.id } }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateStudentModal(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    id:             formData.get('id'),
    first_name:     formData.get('first_name')    || undefined,
    last_name:      formData.get('last_name')     || undefined,
    phone:          formData.get('phone')         || undefined,
    age:            formData.get('age')           || '',
    school_grade:   formData.get('school_grade')  || undefined,
    date_of_birth:  formData.get('date_of_birth') || undefined,
    status:         formData.get('status')        || undefined,
    notes:          formData.get('notes')         || undefined,
    guardians_json: formData.get('guardians_json') || '[]',
    new_email:      formData.get('new_email'),
    new_password:   formData.get('new_password'),
  }

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const guardianResult = parseGuardians(parsed.data.guardians_json)
  if (!guardianResult.ok) {
    return { success: false, error: { code: 'VALIDATION', message: guardianResult.error! } }
  }

  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  const { id, first_name, last_name, phone, age, school_grade, date_of_birth, status, notes, new_email, new_password } = parsed.data

  const { data: old } = await db.from('students').select('user_id, branch_id').eq('id', id).single()
  if (!old) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }

  // Email update
  if (new_email && old.user_id) {
    const { data: currentUser } = await db.from('users').select('email').eq('id', old.user_id).maybeSingle()
    if (currentUser?.email?.toLowerCase() !== new_email) {
      const { data: dup } = await db.from('users').select('id').eq('email', new_email).neq('id', old.user_id).maybeSingle()
      if (dup) return { success: false, error: { code: 'DUPLICATE', message: 'This email is already in use by another account.' } }
      const { error: authErr } = await db.auth.admin.updateUserById(old.user_id, { email: new_email })
      if (authErr) return { success: false, error: { code: 'AUTH_ERROR', message: authErr.message } }
      await db.from('users').update({ email: new_email }).eq('id', old.user_id)
    }
  }

  // Password update
  if (new_password && old.user_id) {
    const { error: authErr } = await db.auth.admin.updateUserById(old.user_id, { password: new_password })
    if (authErr) return { success: false, error: { code: 'AUTH_ERROR', message: `Password update failed: ${authErr.message}` } }
  }

  // Profile update (name + optional DOB)
  const profileUpd: Record<string, unknown> = {}
  if (first_name)                  profileUpd.first_name   = first_name
  if (last_name)                   profileUpd.last_name    = last_name
  if (date_of_birth !== undefined) profileUpd.date_of_birth = date_of_birth || null
  if (Object.keys(profileUpd).length > 0) {
    await db.from('profiles').update(profileUpd).eq('user_id', old.user_id)
  }

  // Phone update
  if (phone !== undefined) {
    await db.from('users').update({ phone: phone || null }).eq('id', old.user_id)
  }

  // Student record update (age, status, notes, grade)
  const studentUpd: Record<string, unknown> = {}
  if (typeof age === 'number')       studentUpd.age          = age
  if (status)                        studentUpd.status       = status
  if (notes !== undefined)           studentUpd.notes        = notes || null
  if (school_grade !== undefined)    studentUpd.school_grade = school_grade || null

  if (Object.keys(studentUpd).length > 0) {
    const { error } = await db.from('students').update(studentUpd).eq('id', id)
    if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // Guardians sync
  await syncGuardians(db, id, guardianResult.guardians)

  // Group assignment sync
  const groupsToAdd    = parseGroupIds(formData.get('groups_to_add_json'))
  const groupsToRemove = parseGroupIds(formData.get('groups_to_remove_json'))
  if (groupsToAdd.length || groupsToRemove.length) {
    await applyGroupAssignments(db, id, groupsToAdd, groupsToRemove)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'student',
    p_entity_id:    id,
    p_new_values:   { first_name, last_name, phone, status },
  })

  revalidatePath('/portal/team-leader/students')
  revalidatePath(`/portal/team-leader/students/${id}`)
  revalidatePath('/admin/students')
  return { success: true, data: { id } }
}

// ── Delete (soft) ──────────────────────────────────────────────────────────────

export async function deleteStudentAction(studentId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('branch_id, user_id')
    .eq('id', studentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!student) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }

  const now = new Date().toISOString()

  await db.from('students')
    .update({ deleted_at: now, status: 'inactive' })
    .eq('id', studentId)

  await db.from('group_students')
    .update({ status: 'dropped', left_at: now })
    .eq('student_id', studentId)
    .eq('status', 'active')

  await db.from('student_enrollments')
    .update({ status: 'DROPPED' })
    .eq('student_id', studentId)
    .eq('status', 'ACTIVE')

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'student',
    p_entity_id:    studentId,
    p_branch_id:    student.branch_id,
  })

  revalidatePath('/portal/team-leader/students')
  revalidatePath('/admin/students')
  return { success: true, data: undefined }
}

export async function bulkDeleteStudentsAction(
  studentIds: string[]
): Promise<ActionResult<{ deleted: string[]; failed: string[] }>> {
  if (!studentIds.length) return { success: true, data: { deleted: [], failed: [] } }

  await requirePermission('manage_students')
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const deleted: string[] = []
  const failed:  string[] = []

  for (const id of studentIds) {
    try {
      const { error } = await db
        .from('students')
        .update({ deleted_at: now, status: 'inactive' })
        .eq('id', id)
        .is('deleted_at', null)

      if (error) { failed.push(id); continue }

      await db.from('group_students')
        .update({ status: 'dropped', left_at: now })
        .eq('student_id', id)
        .eq('status', 'active')

      deleted.push(id)
    } catch {
      failed.push(id)
    }
  }

  revalidatePath('/portal/team-leader/students')
  return { success: true, data: { deleted, failed } }
}
