'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { z } from 'zod'
import type { ActionResult } from '@/types/app'

// ── Schemas ────────────────────────────────────────────────────────────────────

const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const

const createSchema = z.object({
  name:               z.string().min(1, 'Parent name is required').max(200),
  phone1:             z.string().min(7, 'Phone is required').max(30),
  phone2:             z.string().max(30).optional().or(z.literal('')),
  relation:           z.enum(RELATIONS).default('guardian'),
  whatsapp_preferred: z.preprocess(v => v === 'true' || v === true, z.boolean()).default(false),
  notes:              z.string().max(1000).optional().or(z.literal('')),
  student_ids_json:   z.string(),
  // Optional portal access
  email:              z.string().email().optional().or(z.literal('')),
  password:           z.string().min(6).optional().or(z.literal('')),
})

const updateSchema = z.object({
  parent_group_id:    z.string().uuid(),
  name:               z.string().min(1, 'Parent name is required').max(200),
  phone1:             z.string().max(30).optional().or(z.literal('')),
  phone2:             z.string().max(30).optional().or(z.literal('')),
  relation:           z.enum(RELATIONS).default('guardian'),
  whatsapp_preferred: z.preprocess(v => v === 'true' || v === true, z.boolean()).default(false),
  notes:              z.string().max(1000).optional().or(z.literal('')),
  // student management
  students_to_add_json:    z.string().default('[]'),
  contacts_to_remove_json: z.string().default('[]'),
  // portal account (optional)
  user_id:  z.string().uuid().optional().or(z.literal('')),  // existing portal account UUID
  email:    z.string().email().optional().or(z.literal('')),
  password: z.string().min(6).optional().or(z.literal('')),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseIds(raw: string): string[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : []
  } catch { return [] }
}

async function lookupGroupId(
  db: ReturnType<typeof createServiceClient>,
  phone1: string | null | undefined,
  excludeStudentId?: string
): Promise<string | null> {
  if (!phone1) return null
  const q = db
    .from('student_parent_contacts')
    .select('parent_group_id')
    .eq('phone1', phone1)
    .eq('status', 'active')
    .limit(1)
  if (excludeStudentId) q.neq('student_id', excludeStudentId)
  const { data } = await q.maybeSingle()
  return (data as any)?.parent_group_id ?? null
}

// ── Create parent ──────────────────────────────────────────────────────────────

export async function createParentContactAction(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ parent_group_id: string }>> {
  const raw = {
    name:               formData.get('name'),
    phone1:             formData.get('phone1'),
    phone2:             formData.get('phone2')             || '',
    relation:           formData.get('relation')           || 'guardian',
    whatsapp_preferred: formData.get('whatsapp_preferred') || 'false',
    notes:              formData.get('notes')              || '',
    student_ids_json:   formData.get('student_ids_json')   || '[]',
    email:              formData.get('email')              || '',
    password:           formData.get('password')           || '',
  }

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const studentIds = parseIds(parsed.data.student_ids_json)
  if (studentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'Link at least one student' } }
  }

  await requirePermission('manage_students')
  const db = createServiceClient()

  // Reuse group_id if phone already exists for another student
  const existingGroupId = await lookupGroupId(db, parsed.data.phone1 || null)
  const parent_group_id = existingGroupId ?? crypto.randomUUID()

  const { name, phone1, phone2, relation, whatsapp_preferred, notes } = parsed.data

  const inserts = studentIds.map(studentId => ({
    student_id:         studentId,
    parent_group_id,
    name:               name.trim(),
    relation,
    phone1:             phone1 || null,
    phone2:             phone2 || null,
    whatsapp_preferred,
    is_primary:         true,
    is_emergency:       true,
    notes:              notes || null,
    status:             'active',
  }))

  const { error: insertErr } = await db.from('student_parent_contacts').insert(inserts)
  if (insertErr) {
    return { success: false, error: { code: 'DB_ERROR', message: insertErr.message } }
  }

  // Optional portal account
  const email    = parsed.data.email?.trim()
  const password = parsed.data.password?.trim()
  if (email && password) {
    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (!authErr && authData?.user) {
      const uid = authData.user.id
      await db.from('users').upsert({ id: uid, email, phone: phone1 || null }, { onConflict: 'id' })
      const nameParts = name.trim().split(/\s+/)
      await db.from('profiles').upsert(
        { user_id: uid, first_name: nameParts[0] ?? '', last_name: nameParts.slice(1).join(' ') || null },
        { onConflict: 'user_id' }
      )
      // Store plain text for internal ops visibility (intentional — internal system,
      // mirrors students.portal_password) so the welcome-message feature can surface it.
      const { data: parentRow } = await db.from('parents').insert({ user_id: uid, portal_password: password }).select('id').single()
      if (parentRow) {
        await db.from('parent_students').insert(
          studentIds.map(sid => ({
            parent_id:    (parentRow as any).id,
            student_id:   sid,
            relationship: relation,
            is_primary:   true,
          }))
        )
      }
    }
  }

  revalidatePath('/portal/team-leader/parents')
  return { success: true, data: { parent_group_id } }
}

// ── Update parent ──────────────────────────────────────────────────────────────

export async function updateParentContactAction(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<null>> {
  const raw = {
    parent_group_id:         formData.get('parent_group_id'),
    name:                    formData.get('name'),
    phone1:                  formData.get('phone1')             || '',
    phone2:                  formData.get('phone2')             || '',
    relation:                formData.get('relation')           || 'guardian',
    whatsapp_preferred:      formData.get('whatsapp_preferred') || 'false',
    notes:                   formData.get('notes')              || '',
    students_to_add_json:    formData.get('students_to_add_json')    || '[]',
    contacts_to_remove_json: formData.get('contacts_to_remove_json') || '[]',
    user_id:                 formData.get('user_id')            || '',
    email:                   formData.get('email')              || '',
    password:                formData.get('password')           || '',
  }

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  await requirePermission('manage_students')
  const db = createServiceClient()

  const { parent_group_id, name, phone1, phone2, relation, whatsapp_preferred, notes } = parsed.data
  const studentsToAdd    = parseIds(parsed.data.students_to_add_json)
  const contactsToRemove = parseIds(parsed.data.contacts_to_remove_json)
  const existingUserId   = parsed.data.user_id?.trim() || null
  const email            = parsed.data.email?.trim()   || null
  const password         = parsed.data.password?.trim() || null

  // Update all existing entries in this group
  const { error: updateErr } = await db
    .from('student_parent_contacts')
    .update({
      name:               name.trim(),
      phone1:             phone1 || null,
      phone2:             phone2 || null,
      relation,
      whatsapp_preferred,
      notes:              notes || null,
    })
    .eq('parent_group_id', parent_group_id)

  if (updateErr) {
    return { success: false, error: { code: 'DB_ERROR', message: updateErr.message } }
  }

  // Remove specific student contacts
  if (contactsToRemove.length) {
    await db.from('student_parent_contacts').delete().in('id', contactsToRemove)
  }

  // Add new student contacts
  if (studentsToAdd.length) {
    await db.from('student_parent_contacts').insert(
      studentsToAdd.map(studentId => ({
        student_id:         studentId,
        parent_group_id,
        name:               name.trim(),
        relation,
        phone1:             phone1 || null,
        phone2:             phone2 || null,
        whatsapp_preferred,
        is_primary:         true,
        is_emergency:       true,
        notes:              notes || null,
        status:             'active',
      }))
    )
  }

  // ── Portal account ──────────────────────────────────────────────────────────
  if (existingUserId) {
    // Update existing portal account
    const updates: Record<string, string> = {}
    if (email) updates.email = email
    if (password) updates.password = password
    if (Object.keys(updates).length) {
      await db.auth.admin.updateUserById(existingUserId, updates)
      if (email) await db.from('users').update({ email }).eq('id', existingUserId)
      // Store plain text for internal ops visibility (intentional — internal system,
      // mirrors students.portal_password) so the welcome-message feature can surface it.
      if (password) await db.from('parents').update({ portal_password: password }).eq('user_id', existingUserId)
    }
  } else if (email && password) {
    // Create new portal account for this parent
    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (!authErr && authData?.user) {
      const uid = authData.user.id
      await db.from('users').upsert({ id: uid, email, phone: phone1 || null }, { onConflict: 'id' })
      const nameParts = name.trim().split(/\s+/)
      await db.from('profiles').upsert(
        { user_id: uid, first_name: nameParts[0] ?? '', last_name: nameParts.slice(1).join(' ') || null },
        { onConflict: 'user_id' }
      )
      // Get all student_ids for this parent group
      const { data: spcRows } = await db
        .from('student_parent_contacts')
        .select('student_id')
        .eq('parent_group_id', parent_group_id)
        .eq('status', 'active')
      const studentIds = (spcRows ?? []).map((r: any) => r.student_id as string)
      if (studentIds.length) {
        // Store plain text for internal ops visibility (intentional — internal system,
        // mirrors students.portal_password) so the welcome-message feature can surface it.
        const { data: parentRow } = await db.from('parents').insert({ user_id: uid, portal_password: password }).select('id').single()
        if (parentRow) {
          await db.from('parent_students').insert(
            studentIds.map(sid => ({
              parent_id:    (parentRow as any).id,
              student_id:   sid,
              relationship: relation,
              is_primary:   true,
            }))
          )
        }
      }
    }
  }

  revalidatePath('/portal/team-leader/parents')
  return { success: true, data: null }
}

// ── Archive parent ─────────────────────────────────────────────────────────────

export async function archiveParentContactAction(
  parent_group_id: string
): Promise<ActionResult<null>> {
  if (!parent_group_id) return { success: false, error: { code: 'VALIDATION', message: 'Invalid parent' } }

  await requirePermission('manage_students')
  const db = createServiceClient()

  const { error } = await db
    .from('student_parent_contacts')
    .update({ status: 'archived' })
    .eq('parent_group_id', parent_group_id)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/parents')
  return { success: true, data: null }
}

// ── Restore parent ─────────────────────────────────────────────────────────────

export async function restoreParentContactAction(
  parent_group_id: string
): Promise<ActionResult<null>> {
  if (!parent_group_id) return { success: false, error: { code: 'VALIDATION', message: 'Invalid parent' } }

  await requirePermission('manage_students')
  const db = createServiceClient()

  const { error } = await db
    .from('student_parent_contacts')
    .update({ status: 'active' })
    .eq('parent_group_id', parent_group_id)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/parents')
  return { success: true, data: null }
}
