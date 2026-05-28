'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createParentSchema, linkStudentSchema } from './schemas'
import type { ActionResult } from '@/types/app'

export async function createParent(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_parents')
  const db   = createServiceClient()

  const raw = {
    email:        formData.get('email'),
    password:     formData.get('password'),
    first_name:   formData.get('first_name'),
    last_name:    formData.get('last_name'),
    student_id:   formData.get('student_id') || undefined,
    relationship: formData.get('relationship') || undefined,
  }

  const parsed = createParentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { email, password, first_name, last_name, student_id, relationship } = parsed.data

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

  // Upsert parent record
  const { data: existingParent } = await db
    .from('parents')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()

  let parentId: string
  if (existingParent) {
    parentId = existingParent.id
  } else {
    const { data: parent, error: parentError } = await db
      .from('parents')
      .insert({ user_id: authUserId })
      .select('id')
      .single()

    if (parentError) {
      return { success: false, error: { code: 'DB_ERROR', message: parentError.message } }
    }
    parentId = parent.id
  }

  // Optionally link to a student
  if (student_id && relationship) {
    await db.from('parent_students').upsert(
      { parent_id: parentId, student_id, relationship, is_primary: true },
      { onConflict: 'parent_id,student_id', ignoreDuplicates: true }
    )
  }

  const { data: parentRole } = await db.from('roles').select('id').eq('name', 'parent').single()
  if (parentRole) {
    await db.from('user_roles').upsert(
      { user_id: authUserId, role_id: parentRole.id, branch_id: null },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'parent',
    p_entity_id:    parentId,
    p_new_values:   { email, first_name, last_name },
  })

  revalidatePath('/admin/parents')
  redirect('/admin/parents')
}

export async function linkStudentToParent(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_parents')
  const db   = createServiceClient()

  const raw = {
    parent_id:    formData.get('parent_id'),
    student_id:   formData.get('student_id'),
    relationship: formData.get('relationship'),
    is_primary:   formData.get('is_primary') === 'true',
  }

  const parsed = linkStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { parent_id, student_id, relationship, is_primary } = parsed.data

  const { error } = await db.from('parent_students').upsert(
    { parent_id, student_id, relationship, is_primary: is_primary ?? false },
    { onConflict: 'parent_id,student_id' }
  )

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'link_student',
    p_entity_type:  'parent',
    p_entity_id:    parent_id,
    p_new_values:   { student_id, relationship },
  })

  revalidatePath(`/admin/parents/${parent_id}`)
  return { success: true, data: undefined }
}

export async function deleteParent(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_parents')
  const db   = createServiceClient()

  // Get user_id for audit
  const { data: parent } = await db.from('parents').select('user_id').eq('id', id).single()

  // Delete auth user cascades everything
  if (parent) {
    await db.auth.admin.deleteUser(parent.user_id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'parent',
    p_entity_id:    id,
  })

  revalidatePath('/admin/parents')
  return { success: true, data: undefined }
}
