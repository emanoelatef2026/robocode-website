import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/modules/rbac/guards'
import type { Course, CourseListItem } from './types'
import type { PaginatedResult } from '@/types/app'

// Courses are global academy assets — not filtered by branch.
export async function listCourses({
  page = 1,
  perPage = 20,
  search = '',
  scope,
}: {
  page?: number
  perPage?: number
  search?: string
  /** @deprecated branchId filtering removed — courses are global */
  branchId?: string
  scope?: string
} = {}): Promise<PaginatedResult<CourseListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('courses')
    .select(
      `id, title, code, category, level, scope, is_published, branch_id, estimated_hours, created_at`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (scope) query = query.eq('scope', scope)

  if (search) {
    const s = `%${search}%`
    query = query.or(`title.ilike.${s},code.ilike.${s},category.ilike.${s}`)
  }

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: CourseListItem[] = (data ?? []).map((row: any) => ({
    id:              row.id,
    title:           row.title,
    code:            row.code ?? null,
    category:        row.category ?? null,
    level:           row.level ?? null,
    scope:           row.scope,
    is_published:    row.is_published,
    branch_id:       row.branch_id ?? null,
    branch_name:     null,
    estimated_hours: row.estimated_hours ?? null,
    created_at:      row.created_at,
  }))

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getCourse(id: string): Promise<Course | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const db = createServiceClient()

  // Query 1: core columns guaranteed by migration 0006 — never fails on schema issues
  const { data: core, error: coreErr } = await db
    .from('courses')
    .select(`
      id, branch_id, title, description, code, category, level, estimated_hours,
      thumbnail_url, scope, is_published, created_by, deleted_at, created_at, updated_at
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (coreErr || !core) return null

  // Query 2: extended columns added by migrations 0049 + 0058.
  // If these migrations haven't run yet the query returns an error — tolerated.
  const { data: ext } = await db
    .from('courses')
    .select(`
      drive_url, curriculum_folder, instructor_notes, resource_links, session_plans,
      teaching_guide, expected_outcomes, skills_covered, prerequisites, course_roadmap,
      syllabus_url, curriculum_url, homework_drive_url, resources_url, meeting_url,
      preparation_notes, ai_tools_used, recommended_age, prerequisite_course_id
    `)
    .eq('id', id)
    .single()

  const e = (ext ?? {}) as any
  return {
    ...(core as any),
    branch_name:            null,
    drive_url:              e.drive_url              ?? null,
    curriculum_folder:      e.curriculum_folder      ?? null,
    instructor_notes:       e.instructor_notes       ?? null,
    resource_links:         e.resource_links         ?? null,
    session_plans:          e.session_plans          ?? null,
    teaching_guide:         e.teaching_guide         ?? null,
    expected_outcomes:      e.expected_outcomes      ?? null,
    skills_covered:         e.skills_covered         ?? null,
    prerequisites:          e.prerequisites          ?? null,
    course_roadmap:         e.course_roadmap         ?? null,
    syllabus_url:           e.syllabus_url           ?? null,
    curriculum_url:         e.curriculum_url         ?? null,
    homework_drive_url:     e.homework_drive_url     ?? null,
    resources_url:          e.resources_url          ?? null,
    meeting_url:            e.meeting_url            ?? null,
    preparation_notes:      e.preparation_notes      ?? null,
    ai_tools_used:          e.ai_tools_used          ?? null,
    recommended_age:        e.recommended_age        ?? null,
    prerequisite_course_id: e.prerequisite_course_id ?? null,
  } as Course
}
