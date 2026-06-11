'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createCourseSchema, updateCourseSchema } from './schemas'
import type { ActionResult } from '@/types/app'

// Courses are global academy assets — branch ownership checks removed.

export async function createCourse(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    title:           formData.get('title'),
    description:     formData.get('description') || undefined,
    thumbnail_url:   formData.get('thumbnail_url') || undefined,
    resources_url:   formData.get('resources_url') || undefined,
    category:        formData.get('category') || undefined,
    level:           formData.get('level') || undefined,
    estimated_hours: formData.get('estimated_hours') || undefined,
    scope:           formData.get('scope') || 'global',
    is_published:    formData.get('is_published'),
  }

  const parsed = createCourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: course, error } = await db
    .from('courses')
    .insert({
      title:           d.title,
      description:     d.description   || null,
      thumbnail_url:   d.thumbnail_url || null,
      resources_url:   d.resources_url || null,
      category:        d.category      || null,
      level:           (d.level        || null) as string | null,
      estimated_hours: d.estimated_hours ?? null,
      scope:           d.scope,
      is_published:    d.is_published,
      created_by:      user.id,
    })
    .select('id')
    .single()

  if (error || !course) {
    console.error('[createCourse] DB error:', error?.message)
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create course.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'course',
    p_entity_id:    course.id,
    p_new_values:   { title: d.title, scope: d.scope },
  })

  revalidatePath('/admin/courses')
  revalidatePath('/portal/team-leader/courses')

  return { success: true, data: { id: course.id } }
}

export async function updateCourse(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    id:              formData.get('id'),
    title:           formData.get('title'),
    description:     formData.get('description') || undefined,
    thumbnail_url:   formData.get('thumbnail_url') || undefined,
    resources_url:   formData.get('resources_url') || undefined,
    category:        formData.get('category') || undefined,
    level:           formData.get('level') || undefined,
    estimated_hours: formData.get('estimated_hours') || undefined,
    scope:           formData.get('scope') || 'global',
    is_published:    formData.get('is_published'),
  }

  const parsed = updateCourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Resource center fields (not in Zod schema — read directly from FormData)
  const str = (key: string): string | null =>
    (formData.get(key) as string | null)?.trim() || null

  const drive_url         = str('drive_url')
  const curriculum_folder = str('curriculum_folder')
  const instructor_notes  = str('instructor_notes')
  const session_plans     = str('session_plans')
  const teaching_guide    = str('teaching_guide')
  const expected_outcomes = str('expected_outcomes')
  const skills_covered    = str('skills_covered')
  const prerequisites     = str('prerequisites')
  const course_roadmap    = str('course_roadmap')

  const resource_links_raw = str('resource_links')
  let resource_links: Array<{ label: string; url: string }> | null = null
  if (resource_links_raw) {
    try { resource_links = JSON.parse(resource_links_raw) } catch { resource_links = null }
  }

  const { data: existing } = await db
    .from('courses')
    .select('id')
    .eq('id', d.id)
    .is('deleted_at', null)
    .single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Course not found.' } }

  const { error } = await db
    .from('courses')
    .update({
      title:              d.title,
      description:        d.description    || null,
      thumbnail_url:      d.thumbnail_url  || null,
      resources_url:      d.resources_url  || null,
      category:           d.category       || null,
      level:              (d.level         || null) as string | null,
      estimated_hours:    d.estimated_hours ?? null,
      scope:              d.scope,
      is_published:       d.is_published,
      drive_url,
      curriculum_folder,
      instructor_notes,
      resource_links,
      session_plans,
      teaching_guide,
      expected_outcomes,
      skills_covered,
      prerequisites,
      course_roadmap,
    })
    .eq('id', d.id)

  if (error) {
    console.error('[updateCourse] DB error:', error.message)
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'course',
    p_entity_id:    d.id,
    p_new_values:   { title: d.title, is_published: d.is_published },
  })

  revalidatePath('/admin/courses')
  revalidatePath(`/admin/courses/${d.id}`)
  revalidatePath('/portal/team-leader/courses')
  revalidatePath(`/portal/team-leader/courses/${d.id}`)
  return { success: true, data: undefined }
}

export async function deleteCourse(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const { data: existing } = await db
    .from('courses')
    .select('id')
    .eq('id', id)
    .single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Course not found.' } }

  const { error } = await db
    .from('courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete',
    p_entity_type:  'course',
    p_entity_id:    id,
  })

  revalidatePath('/admin/courses')
  revalidatePath('/portal/team-leader/courses')
  return { success: true, data: undefined }
}
