import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { ScheduleListItem, ScheduleDetail } from './types'

export async function listSchedules({
  groupCourseId,
  branchId,
  upcoming,
  limit = 50,
}: {
  groupCourseId?: string
  branchId?: string | string[]
  upcoming?: boolean
  limit?: number
} = {}): Promise<ScheduleListItem[]> {
  const db = createServiceClient()

  let query = db
    .from('schedules')
    .select(
      `id, group_course_id, branch_id, scheduled_at, duration_minutes, type, delivery,
       meeting_url, room, status, topic,
       group_courses!schedules_group_course_id_fkey(
         group_id,
         course_id,
         instructor_id,
         groups!group_courses_group_id_fkey(name),
         courses!group_courses_course_id_fkey(title),
         instructors!group_courses_instructor_id_fkey(
           user_id,
           users!instructors_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )
       ),
       branches!schedules_branch_id_fkey(name)`,
    )
    .order('scheduled_at', { ascending: !upcoming })
    .limit(limit)

  if (groupCourseId) query = query.eq('group_course_id', groupCourseId)
  if (branchId) {
    if (Array.isArray(branchId)) {
      query = query.in('branch_id', branchId)
    } else {
      query = query.eq('branch_id', branchId)
    }
  }

  if (upcoming) {
    query = query.gte('scheduled_at', new Date().toISOString())
    query = query.neq('status', 'cancelled')
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => {
    const gc   = row.group_courses
    const prof = gc?.instructors?.users?.profiles
    return {
      id:               row.id,
      group_course_id:  row.group_course_id,
      branch_id:        row.branch_id,
      scheduled_at:     row.scheduled_at,
      duration_minutes: row.duration_minutes,
      type:             row.type,
      delivery:         row.delivery,
      meeting_url:      row.meeting_url,
      room:             row.room,
      status:           row.status,
      topic:            row.topic,
      group_name:       gc?.groups?.name ?? '',
      course_title:     gc?.courses?.title ?? '',
      instructor_name:  prof
        ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null
        : null,
      branch_name:      row.branches?.name ?? '',
      attendance_count: null,
    } satisfies ScheduleListItem
  })
}

export async function getSchedule(id: string): Promise<ScheduleDetail | null> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('schedules')
    .select(
      `*,
       group_courses!schedules_group_course_id_fkey(
         group_id,
         groups!group_courses_group_id_fkey(name),
         courses!group_courses_course_id_fkey(title),
         instructors!group_courses_instructor_id_fkey(
           user_id,
           users!instructors_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )
       ),
       branches!schedules_branch_id_fkey(name)`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const gc   = (data as any).group_courses
  const prof = gc?.instructors?.users?.profiles

  return {
    ...(data as any),
    group_name:      gc?.groups?.name ?? '',
    course_title:    gc?.courses?.title ?? '',
    branch_name:     (data as any).branches?.name ?? '',
    instructor_name: prof
      ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null
      : null,
  } as ScheduleDetail
}

export async function getUpcomingSchedules(branchId: string | string[], limit = 5): Promise<ScheduleListItem[]> {
  return listSchedules({ branchId, upcoming: true, limit })
}

export interface DashboardStats {
  activeStudents:    number
  activeInstructors: number
  activeGroups:      number
  upcomingSessions:  number
}

export async function getDashboardStats(branchId: string | string[]): Promise<DashboardStats> {
  const db = createServiceClient()

  const now = new Date().toISOString()

  const applyBranch = <T extends object>(q: T): T =>
    Array.isArray(branchId)
      ? (q as any).in('branch_id', branchId)
      : (q as any).eq('branch_id', branchId)

  const [students, instructors, groups, sessions] = await Promise.all([
    applyBranch(
      db.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null)
    ),
    applyBranch(
      db.from('instructors').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null)
    ),
    applyBranch(
      db.from('groups').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null)
    ),
    applyBranch(
      db.from('schedules').select('id', { count: 'exact', head: true }).gte('scheduled_at', now).neq('status', 'cancelled')
    ),
  ])

  return {
    activeStudents:    students.count    ?? 0,
    activeInstructors: instructors.count ?? 0,
    activeGroups:      groups.count      ?? 0,
    upcomingSessions:  sessions.count    ?? 0,
  }
}

export interface GroupDetail {
  id:               string
  name:             string
  code:             string | null
  type:             string
  status:           string
  capacity:         number | null
  branch_id:        string
  branch_name:      string
  semester_id:      string | null
  // course via group_courses
  course_id:        string | null
  course_title:     string | null
  group_course_id:  string | null
  instructor_id:    string | null
  instructor_name:  string | null
  instructor_email: string | null
  // students
  students: Array<{
    id:              string
    first_name:      string | null
    last_name:       string | null
    email:           string
    status:          string
    enrollment_type: 'primary' | 'secondary'
  }>
}

export async function getGroupDetail(id: string): Promise<GroupDetail | null> {
  const db = createServiceClient()

  const [groupRes, gcRes, enrollRes] = await Promise.all([
    db.from('groups')
      .select(`*, branches!groups_branch_id_fkey(name)`)
      .eq('id', id)
      .is('deleted_at', null)
      .single(),

    db.from('group_courses')
      .select(
        `id, course_id, instructor_id,
         courses!group_courses_course_id_fkey(title),
         instructors!group_courses_instructor_id_fkey(
           user_id,
           users!instructors_user_id_fkey(
             email,
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )`
      )
      .eq('group_id', id)
      .eq('status', 'active')
      .maybeSingle(),

    db.from('group_students')
      .select(
        `student_id, status, enrollment_type,
         students!group_students_student_id_fkey(
           id,
           users!students_user_id_fkey(
             email,
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )`
      )
      .eq('group_id', id)
      .eq('status', 'active'),
  ])

  if (groupRes.error || !groupRes.data) return null

  const g   = groupRes.data as any
  const gc  = gcRes.data as any
  const enr = enrollRes.data ?? []

  const instrUser = gc?.instructors?.users
  const instrProf = instrUser?.profiles

  return {
    id:               g.id,
    name:             g.name,
    code:             g.code,
    type:             g.type,
    status:           g.status,
    capacity:         g.capacity,
    branch_id:        g.branch_id,
    branch_name:      g.branches?.name ?? '',
    semester_id:      g.semester_id,
    course_id:        gc?.course_id ?? null,
    course_title:     gc?.courses?.title ?? null,
    group_course_id:  gc?.id ?? null,
    instructor_id:    gc?.instructor_id ?? null,
    instructor_name:  instrProf
      ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null
      : null,
    instructor_email: instrUser?.email ?? null,
    students: enr.map((e: any) => {
      const s    = e.students
      const prof = s?.users?.profiles
      return {
        id:              s?.id ?? e.student_id,
        first_name:      prof?.first_name ?? null,
        last_name:       prof?.last_name  ?? null,
        email:           s?.users?.email ?? '',
        status:          e.status,
        enrollment_type: e.enrollment_type as 'primary' | 'secondary',
      }
    }),
  }
}
