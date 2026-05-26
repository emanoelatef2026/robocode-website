'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createModuleSchema, updateModuleSchema } from './schemas'
import { getNextModuleOrder } from './queries'
import type { ActionResult } from '@/types/app'

export async function createModule(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    course_id:   formData.get('course_id'),
    title:       formData.get('title'),
    description: formData.get('description') || undefined,
  }

  const parsed = createModuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d           = parsed.data
  const order_index = await getNextModuleOrder(d.course_id)

  const { data: mod, error } = await db
    .from('course_modules')
    .insert({
      course_id:   d.course_id,
      title:       d.title,
      description: d.description || null,
      order_index,
      is_published: false,
    })
    .select('id')
    .single()

  if (error || !mod) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create module.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'course_module',
    p_entity_id:    mod.id,
    p_new_values:   { title: d.title, course_id: d.course_id },
  })

  revalidatePath(`/admin/courses/${d.course_id}`)
  return { success: true, data: { id: mod.id } }
}

export async function updateModule(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    id:           formData.get('id'),
    title:        formData.get('title'),
    description:  formData.get('description') || undefined,
    is_published: formData.get('is_published'),
  }

  const parsed = updateModuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: existing, error: fetchError } = await db
    .from('course_modules')
    .select('course_id')
    .eq('id', d.id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Module not found.' } }
  }

  const { error } = await db
    .from('course_modules')
    .update({
      title:        d.title,
      description:  d.description || null,
      is_published: d.is_published,
    })
    .eq('id', d.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'course_module',
    p_entity_id:    d.id,
    p_new_values:   { title: d.title, is_published: d.is_published },
  })

  revalidatePath(`/admin/courses/${existing.course_id}`)
  revalidatePath(`/admin/courses/${existing.course_id}/modules/${d.id}`)
  return { success: true, data: undefined }
}

export async function deleteModule(id: string): Promise<ActionResult<{ courseId: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const { data: existing, error: fetchError } = await db
    .from('course_modules')
    .select('course_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Module not found.' } }
  }

  const { error } = await db
    .from('course_modules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'course_module',
    p_entity_id:    id,
  })

  revalidatePath(`/admin/courses/${existing.course_id}`)
  return { success: true, data: { courseId: existing.course_id } }
}
