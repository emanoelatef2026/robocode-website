'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { friendlyDbError } from '@/lib/db/errors'
import { createCourseSchema, updateCourseSchema } from './schemas'
import { getCourse } from './queries'
import type { Course } from './types'
import type { ActionResult } from '@/types/app'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read a trimmed string from FormData; returns null if blank. */
function fstr(fd: FormData, key: string): string | null {
  return (fd.get(key) as string | null)?.trim() || null
}

/** Parse resource_links JSON from FormData; returns null on any failure. */
function flinks(fd: FormData): Array<{ label: string; url: string }> | null {
  const raw = fstr(fd, 'resource_links')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// ── loadCourseForEdit ─────────────────────────────────────────────────────────

export async function loadCourseForEdit(id: string): Promise<ActionResult<Course>> {
  await requirePermission('manage_courses')
  const course = await getCourse(id)
  if (!course) return { success: false, error: { code: 'NOT_FOUND', message: 'Course not found.' } }
  return { success: true, data: course }
}

// ── createCourse ──────────────────────────────────────────────────────────────
//
// TWO-PHASE STRATEGY (schema-cache safe):
//   Phase 1 — INSERT with guaranteed-0006 columns only.
//              Succeeds regardless of migration state.
//   Phase 2 — UPDATE extended columns (0049 + 0058).
//              Silently skipped if schema cache doesn't know about them yet.
//              Once migration 0077 runs, phase 2 fully activates.

export async function createCourse(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    title:           formData.get('title'),
    code:            formData.get('code')            || undefined,
    description:     formData.get('description')     || undefined,
    thumbnail_url:   formData.get('thumbnail_url')   || undefined,
    resources_url:   formData.get('resources_url')   || undefined,
    category:        formData.get('category')        || undefined,
    level:           formData.get('level')           || undefined,
    estimated_hours: formData.get('estimated_hours') || undefined,
    scope:           formData.get('scope')           || 'global',
    is_published:    formData.get('is_published'),
  }

  const parsed = createCourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // ── Phase 1: insert with 0006 core columns (always safe) ──────────────────
  const { data: course, error: insertError } = await db
    .from('courses')
    .insert({
      title:           d.title,
      code:            d.code           || null,
      description:     d.description    || null,
      thumbnail_url:   d.thumbnail_url  || null,
      category:        d.category       || null,
      level:           (d.level         || null) as string | null,
      estimated_hours: d.estimated_hours ?? null,
      scope:           d.scope,
      is_published:    d.is_published,
      created_by:      user.id,
    })
    .select('id')
    .single()

  if (insertError || !course) {
    console.error('[createCourse] insert error:', insertError?.message)
    return {
      success: false,
      error: {
        code:    'DB_ERROR',
        message: insertError ? friendlyDbError(insertError) : 'Failed to create course.',
      },
    }
  }

  // ── Phase 2: update extended columns (0049 + 0058 — best-effort) ──────────
  const extendedFields = {
    resources_url:      d.resources_url  || null,
    drive_url:          fstr(formData, 'drive_url'),
    curriculum_folder:  fstr(formData, 'curriculum_folder'),
    instructor_notes:   fstr(formData, 'instructor_notes'),
    session_plans:      fstr(formData, 'session_plans'),
    teaching_guide:     fstr(formData, 'teaching_guide'),
    expected_outcomes:  fstr(formData, 'expected_outcomes'),
    skills_covered:     fstr(formData, 'skills_covered'),
    prerequisites:      fstr(formData, 'prerequisites'),
    course_roadmap:     fstr(formData, 'course_roadmap'),
    resource_links:     flinks(formData),
    syllabus_url:       fstr(formData, 'syllabus_url'),
    curriculum_url:     fstr(formData, 'curriculum_url'),
    homework_drive_url: fstr(formData, 'homework_drive_url'),
    meeting_url:        fstr(formData, 'meeting_url'),
    preparation_notes:  fstr(formData, 'preparation_notes'),
    ai_tools_used:      fstr(formData, 'ai_tools_used'),
    recommended_age:    fstr(formData, 'recommended_age'),
  }

  const hasExtended = Object.values(extendedFields).some(v => v !== null)
  if (hasExtended) {
    const { error: extError } = await db
      .from('courses')
      .update(extendedFields)
      .eq('id', course.id)

    if (extError) {
      // Log but do NOT fail — extended columns may not exist if migration 0077
      // hasn't run yet. Core course was created successfully.
      console.warn('[createCourse] Extended fields update skipped:', extError.message)
    }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'course',
    p_entity_id:    course.id,
    p_new_values:   { title: d.title, code: d.code, scope: d.scope },
  })

  revalidatePath('/admin/courses')
  revalidatePath('/portal/team-leader/courses')

  return { success: true, data: { id: course.id } }
}

// ── updateCourse ──────────────────────────────────────────────────────────────
//
// TWO-PHASE STRATEGY:
//   Phase 1 — UPDATE core validated columns.  Returns error to user on failure.
//   Phase 2 — UPDATE extended columns.  Silently skipped if columns missing.

export async function updateCourse(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const raw = {
    id:              formData.get('id'),
    title:           formData.get('title'),
    code:            formData.get('code')            || undefined,
    description:     formData.get('description')     || undefined,
    thumbnail_url:   formData.get('thumbnail_url')   || undefined,
    resources_url:   formData.get('resources_url')   || undefined,
    category:        formData.get('category')        || undefined,
    level:           formData.get('level')           || undefined,
    estimated_hours: formData.get('estimated_hours') || undefined,
    scope:           formData.get('scope')           || 'global',
    is_published:    formData.get('is_published'),
  }

  const parsed = updateCourseSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: existing } = await db
    .from('courses')
    .select('id')
    .eq('id', d.id)
    .is('deleted_at', null)
    .single()

  if (!existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Course not found.' } }
  }

  // ── Phase 1: update core validated columns ────────────────────────────────
  const { error: coreError } = await db
    .from('courses')
    .update({
      title:           d.title,
      code:            d.code           || null,
      description:     d.description    || null,
      thumbnail_url:   d.thumbnail_url  || null,
      resources_url:   d.resources_url  || null,
      category:        d.category       || null,
      level:           (d.level         || null) as string | null,
      estimated_hours: d.estimated_hours ?? null,
      scope:           d.scope,
      is_published:    d.is_published,
    })
    .eq('id', d.id)

  if (coreError) {
    console.error('[updateCourse] core update error:', coreError.message)
    return { success: false, error: { code: 'DB_ERROR', message: friendlyDbError(coreError) } }
  }

  // ── Phase 2: update extended columns (best-effort) ────────────────────────
  const extendedFields = {
    drive_url:          fstr(formData, 'drive_url'),
    curriculum_folder:  fstr(formData, 'curriculum_folder'),
    instructor_notes:   fstr(formData, 'instructor_notes'),
    session_plans:      fstr(formData, 'session_plans'),
    teaching_guide:     fstr(formData, 'teaching_guide'),
    expected_outcomes:  fstr(formData, 'expected_outcomes'),
    skills_covered:     fstr(formData, 'skills_covered'),
    prerequisites:      fstr(formData, 'prerequisites'),
    course_roadmap:     fstr(formData, 'course_roadmap'),
    resource_links:     flinks(formData),
    syllabus_url:       fstr(formData, 'syllabus_url'),
    curriculum_url:     fstr(formData, 'curriculum_url'),
    homework_drive_url: fstr(formData, 'homework_drive_url'),
    meeting_url:        fstr(formData, 'meeting_url'),
    preparation_notes:  fstr(formData, 'preparation_notes'),
    ai_tools_used:      fstr(formData, 'ai_tools_used'),
    recommended_age:    fstr(formData, 'recommended_age'),
  }

  const { error: extError } = await db
    .from('courses')
    .update(extendedFields)
    .eq('id', d.id)

  if (extError) {
    console.warn('[updateCourse] Extended fields update skipped:', extError.message)
    // Do NOT return an error — core fields were saved successfully.
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

// ── deleteCourse ──────────────────────────────────────────────────────────────

export async function deleteCourse(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const db   = createServiceClient()

  const { data: existing } = await db
    .from('courses')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!existing) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Course not found.' } }
  }

  // Block deletion if any active group assignments exist.
  const { count: activeCount } = await db
    .from('group_courses')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', id)
    .eq('status', 'active')

  if ((activeCount ?? 0) > 0) {
    return {
      success: false,
      error: {
        code:    'FK_CONFLICT',
        message: `This course is actively assigned to ${activeCount} group${(activeCount ?? 0) !== 1 ? 's' : ''}. Remove those assignments before deleting.`,
      },
    }
  }

  const { error } = await db
    .from('courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[deleteCourse] error:', error.message)
    return { success: false, error: { code: 'DB_ERROR', message: friendlyDbError(error) } }
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
