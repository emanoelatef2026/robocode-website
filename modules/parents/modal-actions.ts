'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { z } from 'zod'
import type { ActionResult } from '@/types/app'

// ── Schemas ────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  email:             z.string().email('Invalid email address'),
  password:          z.string().min(6, 'Password must be at least 6 characters'),
  first_name:        z.string().min(1, 'First name required').max(100),
  last_name:         z.string().min(1, 'Last name required').max(100),
  phone:             z.string().min(7, 'Primary phone required').max(30),
  student_links_json: z.string(),
})

const updateSchema = z.object({
  id:                z.string().uuid(),
  first_name:        z.string().min(1).max(100).optional().or(z.literal('')),
  last_name:         z.string().min(1).max(100).optional().or(z.literal('')),
  phone:             z.string().max(30).optional().or(z.literal('')),
  email:             z.string().email('Invalid email address').optional().or(z.literal('')),
  new_password:      z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  student_links_json: z.string(),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

interface StudentLink {
  student_id:   string
  relationship: string
  is_primary:   boolean
}

type ParsedLinks =
  | { ok: true;  links: StudentLink[]; error: null }
  | { ok: false; links: never[];       error: string }

function parseLinks(raw: string): ParsedLinks {
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return { ok: false, links: [], error: 'Invalid student links data' }
    if (arr.length === 0)    return { ok: false, links: [], error: 'At least one student must be linked' }
    for (const item of arr) {
      if (!item.student_id || typeof item.student_id !== 'string') {
        return { ok: false, links: [], error: 'Invalid student link: missing student_id' }
      }
    }
    // deduplicate by student_id (keep first occurrence)
    const seen = new Set<string>()
    const deduped: StudentLink[] = []
    for (const item of arr as StudentLink[]) {
      if (!seen.has(item.student_id)) {
        seen.add(item.student_id)
        deduped.push(item)
      }
    }
    return { ok: true, links: deduped, error: null }
  } catch {
    return { ok: false, links: [], error: 'Invalid student links data' }
  }
}

async function syncStudentLinks(
  db: ReturnType<typeof createServiceClient>,
  parentId: string,
  links: StudentLink[]
) {
  await db.from('parent_students').delete().eq('parent_id', parentId)
  if (links.length > 0) {
    await db.from('parent_students').insert(
      links.map(l => ({
        parent_id:    parentId,
        student_id:   l.student_id,
        relationship: l.relationship || 'guardian',
        is_primary:   l.is_primary ?? false,
      }))
    )
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createParentModal(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    email:              formData.get('email'),
    password:           formData.get('password'),
    first_name:         formData.get('first_name'),
    last_name:          formData.get('last_name'),
    phone:              formData.get('phone') || undefined,
    student_links_json: formData.get('student_links_json') || '[]',
  }

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const linksResult = parseLinks(parsed.data.student_links_json)
  if (!linksResult.ok) {
    return { success: false, error: { code: 'VALIDATION', message: linksResult.error! } }
  }

  const user = await requirePermission('manage_parents')
  const db   = createServiceClient()

  const { email, password, first_name, last_name, phone } = parsed.data

  // 1. Check for existing user by email
  let authUserId: string
  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existingUser) {
    // Hard block if this user already owns a parent entity
    const { data: existingParent } = await db
      .from('parents')
      .select('id')
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existingParent) {
      return {
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'A parent account with this email already exists.' },
      }
    }
    authUserId = existingUser.id
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
  await db.from('users').upsert(
    { id: authUserId, email: email.toLowerCase(), phone: phone || null },
    { onConflict: 'id' }
  )

  // 3. profile
  const { data: existingProf } = await db
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()

  if (!existingProf) {
    await db.from('profiles').insert({ user_id: authUserId, first_name, last_name })
  } else {
    await db.from('profiles').update({ first_name, last_name }).eq('user_id', authUserId)
  }

  // 4. parent record (insert only — duplicate email already blocked above)
  const { data: parent, error: parentErr } = await db
    .from('parents')
    .insert({ user_id: authUserId })
    .select('id')
    .single()
  if (parentErr) {
    return { success: false, error: { code: 'DB_ERROR', message: parentErr.message } }
  }
  const parentId = parent.id

  // 5. Parent role
  const { data: parentRole } = await db.from('roles').select('id').eq('name', 'parent').single()
  if (parentRole) {
    await db.from('user_roles').upsert(
      { user_id: authUserId, role_id: parentRole.id, branch_id: null },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  // 6. Student links
  await syncStudentLinks(db, parentId, linksResult.links)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'parent',
    p_entity_id:    parentId,
    p_new_values:   { email, first_name, last_name, phone },
  })

  revalidatePath('/portal/team-leader/parents')
  revalidatePath('/admin/parents')
  return { success: true, data: { id: parentId } }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateParentModal(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    id:                 formData.get('id'),
    first_name:         formData.get('first_name') || undefined,
    last_name:          formData.get('last_name')  || undefined,
    phone:              formData.get('phone')       || undefined,
    email:              formData.get('email')       || undefined,
    new_password:       formData.get('new_password') || undefined,
    student_links_json: formData.get('student_links_json') || '[]',
  }

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const linksResult = parseLinks(parsed.data.student_links_json)
  if (!linksResult.ok) {
    return { success: false, error: { code: 'VALIDATION', message: linksResult.error! } }
  }

  const user = await requirePermission('manage_parents')
  const db   = createServiceClient()

  const { id, first_name, last_name, phone, email, new_password } = parsed.data

  const { data: parent } = await db
    .from('parents')
    .select('user_id')
    .eq('id', id)
    .single()
  if (!parent) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Parent not found.' } }
  }

  // Email update — check for conflicts before applying
  if (email) {
    const { data: conflictUser } = await db
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (conflictUser && conflictUser.id !== parent.user_id) {
      return {
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'This email is already in use by another account.' },
      }
    }

    const { error: authEmailErr } = await db.auth.admin.updateUserById(parent.user_id, { email })
    if (authEmailErr) {
      return { success: false, error: { code: 'AUTH_ERROR', message: authEmailErr.message } }
    }
    await db.from('users').update({ email: email.toLowerCase() }).eq('id', parent.user_id)
  }

  // Password update
  if (new_password) {
    const { error: pwErr } = await db.auth.admin.updateUserById(parent.user_id, { password: new_password })
    if (pwErr) {
      return { success: false, error: { code: 'AUTH_ERROR', message: pwErr.message } }
    }
  }

  // Profile update
  const profileUpd: Record<string, string> = {}
  if (first_name) profileUpd.first_name = first_name
  if (last_name)  profileUpd.last_name  = last_name
  if (Object.keys(profileUpd).length > 0) {
    await db.from('profiles').update(profileUpd).eq('user_id', parent.user_id)
  }

  // Phone update
  if (phone !== undefined) {
    await db.from('users').update({ phone: phone || null }).eq('id', parent.user_id)
  }

  // Student links sync
  await syncStudentLinks(db, id, linksResult.links)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'parent',
    p_entity_id:    id,
    p_new_values:   { first_name, last_name, phone, email_changed: !!email, password_changed: !!new_password },
  })

  revalidatePath('/portal/team-leader/parents')
  revalidatePath('/admin/parents')
  return { success: true, data: { id } }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

/**
 * Soft-deletes a parent record.
 *
 * Safety rules (unless force=true):
 * - Blocked if the parent has any linked student with status='active'.
 * - Allowed (and those links are preserved) for all other states.
 *
 * With force=true the deletion proceeds regardless of child status.
 * All parent_students links are removed before the parent is soft-deleted.
 */
export async function deleteParentAction(
  parentId: string,
  opts: { force?: boolean } = {}
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_parents')
  const db   = createServiceClient()

  // Load parent + current links
  const { data: parent } = await db
    .from('parents')
    .select('user_id')
    .eq('id', parentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!parent) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Parent not found or already deleted.' } }
  }

  if (!opts.force) {
    // Check for active linked students
    const { data: links } = await db
      .from('parent_students')
      .select('student_id, students!parent_students_student_id_fkey(status, deleted_at)')
      .eq('parent_id', parentId)

    const activeStudents = ((links ?? []) as any[]).filter(l => {
      const s = l.students
      return s && s.deleted_at === null && s.status === 'active'
    })

    if (activeStudents.length > 0) {
      return {
        success: false,
        error: {
          code: 'HAS_ACTIVE_STUDENTS',
          message: `This parent has ${activeStudents.length} active linked student${activeStudents.length !== 1 ? 's' : ''}. Remove those links first, or use force delete.`,
        },
      }
    }
  }

  // Remove all student links
  await db.from('parent_students').delete().eq('parent_id', parentId)

  // Soft-delete the parent
  const { error: delErr } = await db
    .from('parents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parentId)

  if (delErr) {
    return { success: false, error: { code: 'DB_ERROR', message: delErr.message } }
  }

  // Revoke parent role from user_roles
  const { data: parentRole } = await db.from('roles').select('id').eq('name', 'parent').maybeSingle()
  if (parentRole) {
    await db.from('user_roles')
      .delete()
      .eq('user_id', parent.user_id)
      .eq('role_id', (parentRole as { id: string }).id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'parent',
    p_entity_id:    parentId,
    p_new_values:   { force: opts.force ?? false },
  })

  revalidatePath('/portal/team-leader/parents')
  revalidatePath('/admin/parents')
  return { success: true, data: { id: parentId } }
}

// ── Reset Password ─────────────────────────────────────────────────────────────

export async function resetParentPassword(
  parentId: string
): Promise<ActionResult<{ temp_password: string }>> {
  const user = await requirePermission('manage_parents')
  const db   = createServiceClient()

  const { data: parent } = await db
    .from('parents')
    .select('user_id')
    .eq('id', parentId)
    .single()

  if (!parent) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Parent not found.' } }
  }

  const tempPassword = generateTempPassword()

  const { error: pwErr } = await db.auth.admin.updateUserById(parent.user_id, { password: tempPassword })
  if (pwErr) {
    return { success: false, error: { code: 'AUTH_ERROR', message: pwErr.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'password_reset',
    p_entity_type:  'parent',
    p_entity_id:    parentId,
    p_new_values:   { reset_by: user.id, temp_password_set: true },
  })

  revalidatePath('/portal/team-leader/parents')
  return { success: true, data: { temp_password: tempPassword } }
}
