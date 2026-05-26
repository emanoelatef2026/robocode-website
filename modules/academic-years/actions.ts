'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createAcademicYearSchema, updateAcademicYearSchema } from './schemas'
import type { ActionResult } from '@/types/app'

const DEFAULT_ORG = 'a0000000-0000-0000-0000-000000000001'

export async function createAcademicYear(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const parsed = createAcademicYearSchema.safeParse({
    name:       formData.get('name'),
    start_date: formData.get('start_date'),
    end_date:   formData.get('end_date'),
    is_current: formData.get('is_current'),
  })

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  if (d.is_current) {
    await db.from('academic_years').update({ is_current: false }).eq('org_id', DEFAULT_ORG)
  }

  const { data: year, error } = await db
    .from('academic_years')
    .insert({ org_id: DEFAULT_ORG, name: d.name, start_date: d.start_date, end_date: d.end_date, is_current: d.is_current })
    .select('id')
    .single()

  if (error || !year) {
    if (error?.code === '23505') {
      return { success: false, error: { code: 'DUPLICATE', message: 'An academic year with this name already exists.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create academic year.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'academic_year',
    p_entity_id:    year.id,
    p_new_values:   { name: d.name },
  })

  revalidatePath('/admin/semesters')
  return { success: true, data: { id: year.id } }
}

export async function updateAcademicYear(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const parsed = updateAcademicYearSchema.safeParse({
    id:         formData.get('id'),
    name:       formData.get('name'),
    start_date: formData.get('start_date'),
    end_date:   formData.get('end_date'),
    is_current: formData.get('is_current'),
  })

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  if (d.is_current) {
    await db.from('academic_years').update({ is_current: false }).eq('org_id', DEFAULT_ORG).neq('id', d.id)
  }

  const { error } = await db
    .from('academic_years')
    .update({ name: d.name, start_date: d.start_date, end_date: d.end_date, is_current: d.is_current })
    .eq('id', d.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'academic_year',
    p_entity_id:    d.id,
    p_new_values:   { name: d.name, is_current: d.is_current },
  })

  revalidatePath('/admin/semesters')
  return { success: true, data: undefined }
}

export async function deleteAcademicYear(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const { error } = await db.from('academic_years').delete().eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'academic_year',
    p_entity_id:    id,
  })

  revalidatePath('/admin/semesters')
  return { success: true, data: undefined }
}
