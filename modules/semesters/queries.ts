import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  Semester, SemesterListItem, SemesterEnrollment,
  SemesterCourse, SemesterGroup, SemesterDashboard,
} from './types'
import type { PaginatedResult } from '@/types/app'

const DEFAULT_ORG = 'a0000000-0000-0000-0000-000000000001'

export async function listSemesters({
  page = 1,
  perPage = 20,
  search = '',
  status,
  academicYearId,
}: {
  page?: number
  perPage?: number
  search?: string
  status?: string
  academicYearId?: string
} = {}): Promise<PaginatedResult<SemesterListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('semesters')
    .select(
      `id, name, slug, status, start_date, end_date, max_capacity, academic_year_id,
       academic_years!semesters_academic_year_id_fkey(name),
       semester_enrollments!semester_enrollments_semester_id_fkey(count)`,
      { count: 'exact' }
    )
    .eq('org_id', DEFAULT_ORG)
    .order('start_date', { ascending: false })
    .range(from, to)

  if (status)         query = query.eq('status', status)
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)
  if (search)         query = query.ilike('name', `%${search}%`)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: SemesterListItem[] = (data ?? []).map((row: any) => ({
    id:                 row.id,
    name:               row.name,
    slug:               row.slug,
    status:             row.status,
    start_date:         row.start_date,
    end_date:           row.end_date,
    max_capacity:       row.max_capacity ?? null,
    academic_year_id:   row.academic_year_id,
    academic_year_name: row.academic_years?.name ?? '—',
    enrolled_count:     row.semester_enrollments?.[0]?.count ?? 0,
  }))

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getSemester(id: string): Promise<Semester | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('semesters')
    .select(`*, academic_years!semesters_academic_year_id_fkey(name)`)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return {
    ...(data as any),
    academic_year_name: (data as any).academic_years?.name ?? null,
  } as Semester
}

export async function getSemesterDashboard(id: string): Promise<SemesterDashboard | null> {
  const db = createServiceClient()

  const [{ data: sem }, { data: enrollCounts }, { data: groups }, { data: courses }] =
    await Promise.all([
      db.from('semesters')
        .select(`*, academic_years!semesters_academic_year_id_fkey(name)`)
        .eq('id', id)
        .single(),
      db.from('semester_enrollments')
        .select('status')
        .eq('semester_id', id),
      db.from('groups')
        .select('id')
        .eq('semester_id', id)
        .is('deleted_at', null),
      db.from('semester_courses')
        .select('id')
        .eq('semester_id', id),
    ])

  if (!sem) return null

  const semester = {
    ...(sem as any),
    academic_year_name: (sem as any).academic_years?.name ?? null,
  } as Semester

  const enrolled_count  = (enrollCounts ?? []).filter((e: any) => e.status === 'enrolled').length
  const dropped_count   = (enrollCounts ?? []).filter((e: any) => e.status === 'dropped').length
  const completed_count = (enrollCounts ?? []).filter((e: any) => e.status === 'completed').length
  const total_enrolled  = enrolled_count + completed_count

  return {
    semester,
    enrolled_count,
    dropped_count,
    completed_count,
    group_count:  (groups ?? []).length,
    course_count: (courses ?? []).length,
    capacity_pct: semester.max_capacity && semester.max_capacity > 0
      ? Math.round((total_enrolled / semester.max_capacity) * 100)
      : null,
  }
}

export async function listSemesterEnrollments(
  semesterId: string,
  { status }: { status?: string } = {}
): Promise<SemesterEnrollment[]> {
  const db = createServiceClient()

  let query = db
    .from('semester_enrollments')
    .select(
      `id, semester_id, student_id, branch_id, status, enrolled_at, dropped_at,
       completed_at, notes, payment_status,
       students!semester_enrollments_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       branches!semester_enrollments_branch_id_fkey(name)`
    )
    .eq('semester_id', semesterId)
    .order('enrolled_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:            row.id,
    semester_id:   row.semester_id,
    student_id:    row.student_id,
    branch_id:     row.branch_id,
    status:        row.status,
    enrolled_at:   row.enrolled_at,
    dropped_at:    row.dropped_at ?? null,
    completed_at:  row.completed_at ?? null,
    notes:         row.notes ?? null,
    payment_status: row.payment_status,
    student_email: row.students?.users?.email ?? '',
    first_name:    row.students?.users?.profiles?.first_name ?? null,
    last_name:     row.students?.users?.profiles?.last_name ?? null,
    branch_name:   row.branches?.name ?? '',
  }))
}

export async function listSemesterCourses(semesterId: string): Promise<SemesterCourse[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('semester_courses')
    .select(
      `id, semester_id, course_id, created_at,
       courses!semester_courses_course_id_fkey(title, code, level, scope)`
    )
    .eq('semester_id', semesterId)
    .order('created_at', { ascending: true })

  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:           row.id,
    semester_id:  row.semester_id,
    course_id:    row.course_id,
    created_at:   row.created_at,
    course_title: row.courses?.title ?? '',
    course_code:  row.courses?.code ?? null,
    course_level: row.courses?.level ?? null,
    course_scope: row.courses?.scope ?? 'branch',
  }))
}

export async function listSemesterGroups(semesterId: string): Promise<SemesterGroup[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('groups')
    .select(`id, name, code, type, status, capacity, branch_id, branches!groups_branch_id_fkey(name)`)
    .eq('semester_id', semesterId)
    .is('deleted_at', null)
    .order('name')

  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:          row.id,
    name:        row.name,
    code:        row.code ?? null,
    type:        row.type,
    status:      row.status,
    capacity:    row.capacity ?? null,
    branch_id:   row.branch_id,
    branch_name: row.branches?.name ?? '',
  }))
}
