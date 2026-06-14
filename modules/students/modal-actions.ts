'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { z } from 'zod'
import type { ActionResult } from '@/types/app'

// ── Validation ─────────────────────────────────────────────────────────────────

const parentContactSchema = z.object({
  name:               z.string().min(1, 'Guardian name required').max(200),
  relation:           z.enum(['father', 'mother', 'guardian', 'other']).default('guardian'),
  phone1:             z.string().min(7, 'Phone 1 required').max(30),
  phone2:             z.string().max(30).optional().or(z.literal('')),
  whatsapp_preferred: z.boolean().default(false),
  is_primary:         z.boolean().default(false),
  is_emergency:       z.boolean().default(true),
  email:              z.string().email().optional().or(z.literal('')),
  password:           z.string().min(6).optional().or(z.literal('')),
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
  parent_contacts_json:  z.string(),
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
  parent_contacts_json: z.string(),
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

type ParsedParentContacts =
  | { ok: true;  contacts: z.infer<typeof parentContactSchema>[]; error: null }
  | { ok: false; contacts: never[];                               error: string }

function parseParentContacts(raw: string): ParsedParentContacts {
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return { ok: false, contacts: [], error: 'Invalid contacts data' }
    const result: z.infer<typeof parentContactSchema>[] = []
    for (let i = 0; i < arr.length; i++) {
      const r = parentContactSchema.safeParse(arr[i])
      if (!r.success) return { ok: false, contacts: [], error: `Contact ${i + 1}: ${r.error.issues[0].message}` }
      result.push(r.data)
    }
    if (result.length === 0) return { ok: false, contacts: [], error: 'At least one contact is required' }
    return { ok: true, contacts: result, error: null }
  } catch {
    return { ok: false, contacts: [], error: 'Invalid contacts data' }
  }
}

async function syncParentContacts(
  db: ReturnType<typeof createServiceClient>,
  studentId: string,
  contacts: z.infer<typeof parentContactSchema>[]
) {
  // Save existing group UUIDs keyed by phone1 so we preserve stable parent identity
  const { data: existing } = await db
    .from('student_parent_contacts')
    .select('phone1, parent_group_id')
    .eq('student_id', studentId)

  const existingGroupByPhone = new Map<string, string>()
  for (const row of (existing ?? []) as { phone1: string | null; parent_group_id: string }[]) {
    if (row.phone1 && row.parent_group_id) existingGroupByPhone.set(row.phone1, row.parent_group_id)
  }

  await db.from('student_parent_contacts').delete().eq('student_id', studentId)

  if (contacts.length === 0) return

  // Resolve parent_group_id for each contact:
  //   1. Reuse existing UUID for this student+phone
  //   2. Look up another student's contact with same phone
  //   3. Fall back to new UUID
  const uniqueNewPhones = [...new Set(
    contacts.map(c => c.phone1?.trim()).filter((p): p is string => !!p && !existingGroupByPhone.has(p))
  )]

  const dbGroupByPhone = new Map<string, string>()
  if (uniqueNewPhones.length > 0) {
    const { data: matches } = await db
      .from('student_parent_contacts')
      .select('phone1, parent_group_id')
      .in('phone1', uniqueNewPhones)
      .neq('student_id', studentId)
      .limit(uniqueNewPhones.length * 2)
    for (const row of (matches ?? []) as { phone1: string | null; parent_group_id: string }[]) {
      if (row.phone1 && !dbGroupByPhone.has(row.phone1)) dbGroupByPhone.set(row.phone1, row.parent_group_id)
    }
  }

  const resolvedContacts = contacts.map(c => {
    const phone = c.phone1?.trim() || null
    const parent_group_id =
      (phone && existingGroupByPhone.get(phone)) ??
      (phone && dbGroupByPhone.get(phone)) ??
      crypto.randomUUID()
    return { ...c, phone, parent_group_id }
  })

  await db.from('student_parent_contacts').insert(
    resolvedContacts.map(c => ({
      student_id:         studentId,
      parent_group_id:    c.parent_group_id,
      name:               c.name,
      relation:           c.relation,
      phone1:             c.phone,
      phone2:             c.phone2 || null,
      whatsapp_preferred: c.whatsapp_preferred,
      is_primary:         c.is_primary,
      is_emergency:       c.is_emergency,
      status:             'active',
    }))
  )

  // Create portal accounts for contacts that have email+password
  for (const c of resolvedContacts) {
    const email    = c.email?.trim()    || null
    const password = c.password?.trim() || null
    if (!email || !password) continue

    // Check if an account already exists for this email
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) continue  // account already exists — skip

    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authErr || !authData?.user) continue

    const uid       = authData.user.id
    const nameParts = c.name.trim().split(/\s+/)
    await db.from('users').upsert({ id: uid, email, phone: c.phone || null }, { onConflict: 'id' })
    await db.from('profiles').upsert(
      { user_id: uid, first_name: nameParts[0] ?? '', last_name: nameParts.slice(1).join(' ') || null },
      { onConflict: 'user_id' }
    )
    const { data: parentRow } = await db.from('parents').insert({ user_id: uid }).select('id').single()
    if (parentRow) {
      await db.from('parent_students').insert({
        parent_id:    (parentRow as any).id,
        student_id:   studentId,
        relationship: c.relation,
        is_primary:   c.is_primary,
      })
    }
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
    parent_contacts_json:  formData.get('parent_contacts_json') || '[]',
  }

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const contactResult = parseParentContacts(parsed.data.parent_contacts_json)
  if (!contactResult.ok) {
    return { success: false, error: { code: 'VALIDATION', message: contactResult.error! } }
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

  // 4. Student record (with required age)
  const { data: student, error: stuErr } = await db
    .from('students')
    .insert({
      user_id:         authUserId,
      branch_id,
      enrollment_date: enrollment_date || new Date().toISOString().split('T')[0],
      status:          'active',
      age,
      notes:           notes || null,
      school_grade:    school_grade || null,
    })
    .select('id')
    .single()

  if (stuErr) {
    if (stuErr.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'This student is already enrolled in this branch.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: stuErr.message } }
  }

  // 5b. Student role
  const { data: studentRole } = await db.from('roles').select('id').eq('name', 'student').single()
  if (studentRole) {
    await db.from('user_roles').upsert(
      { user_id: authUserId, role_id: studentRole.id, branch_id },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  // 5. Parent contacts
  await syncParentContacts(db, student.id, contactResult.contacts)

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
    parent_contacts_json: formData.get('parent_contacts_json') || '[]',
    new_email:      formData.get('new_email'),
    new_password:   formData.get('new_password'),
  }

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const contactResult = parseParentContacts(parsed.data.parent_contacts_json)
  if (!contactResult.ok) {
    return { success: false, error: { code: 'VALIDATION', message: contactResult.error! } }
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

  // Parent contacts sync
  await syncParentContacts(db, id, contactResult.contacts)

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
