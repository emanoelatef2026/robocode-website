import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { CourseModule, CourseModuleListItem } from './types'

export async function listModules(courseId: string): Promise<CourseModuleListItem[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('course_modules')
    .select('id, course_id, title, description, order_index, is_published')
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id:           row.id,
    course_id:    row.course_id,
    title:        row.title,
    description:  row.description ?? null,
    order_index:  row.order_index,
    is_published: row.is_published,
  }))
}

export async function getModule(id: string): Promise<CourseModule | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('course_modules')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as CourseModule
}

// Returns a flat list of {id, course_id, title} for multiple courses at once.
// Used by AcademicConfigCard to build the courseId → semesters map client-side.
export async function listModulesByCourseIds(
  courseIds: string[]
): Promise<{ id: string; course_id: string; title: string; order_index: number }[]> {
  if (courseIds.length === 0) return []
  const db = createServiceClient()
  const { data } = await db
    .from('course_modules')
    .select('id, course_id, title, order_index')
    .in('course_id', courseIds)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  return (data ?? []).map((row: any) => ({
    id:          row.id,
    course_id:   row.course_id,
    title:       row.title,
    order_index: row.order_index,
  }))
}

export async function getNextModuleOrder(courseId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from('course_modules')
    .select('order_index')
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.order_index ?? 0) + 1
}
