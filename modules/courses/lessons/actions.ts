'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createLessonSchema, updateLessonSchema } from './schemas'
import { getNextLessonOrder } from './queries'
import type { ActionResult } from '@/types/app'

export async function createLesson(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    module_id:        formData.get('module_id'),
    title:            formData.get('title'),
    type:             formData.get('type') || 'text',
    duration_minutes: formData.get('duration_minutes') || undefined,
    video_url:        formData.get('video_url') || undefined,
    video_provider:   formData.get('video_provider') || undefined,
  }

  const parsed = createLessonSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d           = parsed.data
  const order_index = await getNextLessonOrder(d.module_id)

  const { data: mod } = await db
    .from('course_modules')
    .select('course_id')
    .eq('id', d.module_id)
    .is('deleted_at', null)
    .single()

  const { data: lesson, error } = await db
    .from('lessons')
    .insert({
      module_id:        d.module_id,
      title:            d.title,
      type:             d.type,
      duration_minutes: d.duration_minutes ?? null,
      video_url:        d.video_url || null,
      video_provider:   (d.video_provider || null) as string | null,
      order_index,
      is_published:     false,
    })
    .select('id')
    .single()

  if (error || !lesson) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create lesson.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'lesson',
    p_entity_id:    lesson.id,
    p_new_values:   { title: d.title, module_id: d.module_id },
  })

  if (mod) {
    revalidatePath(`/admin/courses/${mod.course_id}/modules/${d.module_id}`)
  }
  return { success: true, data: { id: lesson.id } }
}

export async function updateLesson(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    id:               formData.get('id'),
    title:            formData.get('title'),
    type:             formData.get('type') || 'text',
    duration_minutes: formData.get('duration_minutes') || undefined,
    video_url:        formData.get('video_url') || undefined,
    video_provider:   formData.get('video_provider') || undefined,
    is_published:     formData.get('is_published'),
  }

  const parsed = updateLessonSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: existing, error: fetchError } = await db
    .from('lessons')
    .select('module_id, course_modules!lessons_module_id_fkey(course_id)')
    .eq('id', d.id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Lesson not found.' } }
  }

  const { error } = await db
    .from('lessons')
    .update({
      title:            d.title,
      type:             d.type,
      duration_minutes: d.duration_minutes ?? null,
      video_url:        d.video_url || null,
      video_provider:   (d.video_provider || null) as string | null,
      is_published:     d.is_published,
    })
    .eq('id', d.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'lesson',
    p_entity_id:    d.id,
    p_new_values:   { title: d.title, is_published: d.is_published },
  })

  const courseId = (existing as any).course_modules?.course_id
  if (courseId) {
    revalidatePath(`/admin/courses/${courseId}/modules/${existing.module_id}`)
  }
  return { success: true, data: undefined }
}

export async function deleteLesson(id: string): Promise<ActionResult<{ moduleId: string; courseId: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const { data: existing, error: fetchError } = await db
    .from('lessons')
    .select('module_id, course_modules!lessons_module_id_fkey(course_id)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Lesson not found.' } }
  }

  const { error } = await db
    .from('lessons')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'lesson',
    p_entity_id:    id,
  })

  const courseId = (existing as any).course_modules?.course_id ?? ''
  revalidatePath(`/admin/courses/${courseId}/modules/${existing.module_id}`)
  return { success: true, data: { moduleId: existing.module_id, courseId } }
}
