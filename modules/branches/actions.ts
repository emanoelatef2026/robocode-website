'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createBranchSchema, updateBranchSchema } from './schemas'
import type { ActionResult } from '@/types/app'

const DEFAULT_ORG = 'a0000000-0000-0000-0000-000000000001'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createBranch(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_branches')
  const db   = createServiceClient()

  const raw = {
    name:     formData.get('name'),
    type:     formData.get('type'),
    phone:    formData.get('phone') || undefined,
    location: formData.get('location') || undefined,
    timezone: formData.get('timezone') || undefined,
  }

  const parsed = createBranchSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { name, type, phone, location, timezone } = parsed.data

  let slug = slugify(name)

  // Deduplicate slug within org
  const { data: existing } = await db
    .from('branches')
    .select('slug')
    .eq('org_id', DEFAULT_ORG)
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const { data: branch, error } = await db
    .from('branches')
    .insert({
      org_id:    DEFAULT_ORG,
      name,
      slug,
      type,
      phone:     phone || null,
      location:  location || null,
      timezone:  timezone || 'Africa/Cairo',
      is_active: true,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'branch',
    p_entity_id:    branch.id,
    p_new_values:   { name, type, slug },
  })

  revalidatePath('/admin/branches')
  redirect('/admin/branches')
}

export async function updateBranch(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_branches')
  const db   = createServiceClient()

  const raw = {
    id:        formData.get('id'),
    name:      formData.get('name'),
    type:      formData.get('type'),
    phone:     formData.get('phone') || undefined,
    location:  formData.get('location') || undefined,
    timezone:  formData.get('timezone') || undefined,
    is_active: formData.get('is_active') === 'true',
  }

  const parsed = updateBranchSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, name, type, phone, location, timezone, is_active } = parsed.data

  // Fetch old values for audit
  const { data: old } = await db.from('branches').select('name, type, is_active').eq('id', id).single()

  const { error } = await db
    .from('branches')
    .update({ name, type, phone: phone || null, location: location || null, timezone, is_active })
    .eq('id', id)
    .eq('org_id', DEFAULT_ORG)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'branch',
    p_entity_id:    id,
    p_old_values:   old ?? null,
    p_new_values:   { name, type, is_active },
    p_branch_id:    id,
  })

  revalidatePath('/admin/branches')
  revalidatePath(`/admin/branches/${id}`)
  redirect('/admin/branches')
}

export async function deleteBranch(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_branches')
  const db   = createServiceClient()

  const { error } = await db
    .from('branches')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .eq('org_id', DEFAULT_ORG)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'branch',
    p_entity_id:    id,
    p_branch_id:    id,
  })

  revalidatePath('/admin/branches')
  return { success: true, data: undefined }
}
