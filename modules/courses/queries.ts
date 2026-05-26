import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Course, CourseListItem } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listCourses({
  page = 1,
  perPage = 20,
  search = '',
  branchId,
  scope,
}: {
  page?: number
  perPage?: number
  search?: string
  branchId?: string
  scope?: string
} = {}): Promise<PaginatedResult<CourseListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('courses')
    .select(
      `id, title, code, category, level, scope, is_published, branch_id, estimated_hours, created_at,
       branches!courses_branch_id_fkey(name)`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (branchId) query = query.eq('branch_id', branchId)
  if (scope)    query = query.eq('scope', scope)

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
    branch_name:     row.branches?.name ?? null,
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
  const db = createServiceClient()
  const { data, error } = await db
    .from('courses')
    .select(`*, branches!courses_branch_id_fkey(name)`)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return {
    ...(data as any),
    branch_name: (data as any).branches?.name ?? null,
  } as Course
}
