import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Assignment, AssignmentListItem, ModuleForSelect } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listAssignments({
  page = 1,
  perPage = 20,
  search = '',
  type,
  status,
  moduleId,
}: {
  page?: number
  perPage?: number
  search?: string
  type?: string
  status?: string
  moduleId?: string
} = {}): Promise<PaginatedResult<AssignmentListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('assignments')
    .select(
      `id, title, type, submission_type, status, due_at, max_score, lesson_id, module_id, created_at,
       lessons!assignments_lesson_id_fkey(
         title,
         course_modules!lessons_module_id_fkey(
           title,
           courses!course_modules_course_id_fkey(title)
         )
       ),
       course_modules!assignments_module_id_fkey(
         title,
         courses!course_modules_course_id_fkey(title)
       ),
       submissions!submissions_assignment_id_fkey(count)`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (type)     query = query.eq('type', type)
  if (status)   query = query.eq('status', status)
  if (moduleId) query = query.eq('module_id', moduleId)
  if (search)   query = query.ilike('title', `%${search}%`)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: AssignmentListItem[] = (data ?? []).map((row: any) => {
    const lessonRow  = row.lessons
    const moduleRow  = row.course_modules
    const lessonMod  = lessonRow?.course_modules
    const fromLesson = lessonMod?.courses?.title ?? null
    const fromModule = moduleRow?.courses?.title ?? null

    return {
      id:              row.id,
      title:           row.title,
      type:            row.type,
      submission_type: row.submission_type,
      status:          row.status,
      due_at:          row.due_at ?? null,
      max_score:       row.max_score,
      lesson_id:       row.lesson_id ?? null,
      module_id:       row.module_id ?? null,
      lesson_title:    lessonRow?.title ?? null,
      module_title:    moduleRow?.title ?? lessonMod?.title ?? null,
      course_title:    fromLesson ?? fromModule,
      schedule_id:     row.schedule_id ?? null,
      schedule_topic:  null,
      submission_count: row.submissions?.[0]?.count ?? 0,
      created_at:      row.created_at,
    }
  })

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignments')
    .select(
      `*,
       lessons!assignments_lesson_id_fkey(
         title,
         course_modules!lessons_module_id_fkey(
           title,
           courses!course_modules_course_id_fkey(title)
         )
       ),
       course_modules!assignments_module_id_fkey(
         title,
         courses!course_modules_course_id_fkey(title)
       ),
       submissions!submissions_assignment_id_fkey(count)`
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null

  const row       = data as any
  const lessonRow = row.lessons
  const moduleRow = row.course_modules
  const lessonMod = lessonRow?.course_modules

  return {
    ...row,
    lesson_title:    lessonRow?.title ?? null,
    module_title:    moduleRow?.title ?? lessonMod?.title ?? null,
    course_title:    moduleRow?.courses?.title ?? lessonMod?.courses?.title ?? null,
    rubric:          row.rubric ?? [],
    submission_count: row.submissions?.[0]?.count ?? 0,
  } as Assignment
}

export async function listModulesForSelect(): Promise<ModuleForSelect[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('course_modules')
    .select(`id, title, course_id, courses!course_modules_course_id_fkey(title)`)
    .is('deleted_at', null)
    .order('title')

  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:           row.id,
    title:        row.title,
    course_id:    row.course_id,
    course_title: row.courses?.title ?? '',
  }))
}
