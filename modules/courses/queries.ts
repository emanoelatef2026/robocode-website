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

  const filtered = search
    ? items.filter((c) =>
        `${c.title} ${c.code ?? ''} ${c.category ?? ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : items

  return {
    data:       filtered,
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
  const { data, error } = await db
    .from('courses')
    .select(`id, branch_id, title, description, code, category, level, estimated_hours, thumbnail_url, scope, is_published, created_by, deleted_at, created_at, updated_at, drive_url, curriculum_folder, instructor_notes, resource_links, session_plans, teaching_guide, expected_outcomes, skills_covered, prerequisites, course_roadmap`)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null

  const d = data as any
  return {
    ...d,
    branch_name:       null,
    drive_url:         d.drive_url         ?? null,
    curriculum_folder: d.curriculum_folder ?? null,
    instructor_notes:  d.instructor_notes  ?? null,
    resource_links:    d.resource_links    ?? null,
    session_plans:     d.session_plans     ?? null,
    teaching_guide:    d.teaching_guide    ?? null,
    expected_outcomes: d.expected_outcomes ?? null,
    skills_covered:    d.skills_covered    ?? null,
    prerequisites:     d.prerequisites     ?? null,
    course_roadmap:    d.course_roadmap    ?? null,
  } as Course
}
