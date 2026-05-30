import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser, isBranchAccessible } from '@/modules/rbac/guards'
import type { Group, GroupListItem, GroupEnrollment, GroupAcademicConfig, GroupScheduleItem } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listGroups({
  page = 1,
  perPage = 20,
  search = '',
  branchId,
  status,
  type,
  instructorId,
}: {
  page?: number
  perPage?: number
  search?: string
  branchId?: string | string[]
  status?: string
  type?: string
  instructorId?: string
} = {}): Promise<PaginatedResult<GroupListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  // If instructor filter: pre-query group IDs from group_instructors + group_courses
  let restrictToGroupIds: string[] | null = null
  if (instructorId) {
    const [{ data: giRows }, { data: gcRows }] = await Promise.all([
      db.from('group_instructors').select('group_id').eq('instructor_id', instructorId),
      db.from('group_courses').select('group_id').eq('instructor_id', instructorId).eq('status', 'active'),
    ])
    const ids = [
      ...(giRows ?? []).map((r: any) => r.group_id as string),
      ...(gcRows ?? []).map((r: any) => r.group_id as string),
    ]
    restrictToGroupIds = [...new Set(ids)]
    if (restrictToGroupIds.length === 0) {
      return { data: [], total: 0, page, perPage, totalPages: 0 }
    }
  }

  let query = db
    .from('groups')
    .select(
      `id, branch_id, name, code, type, capacity, status,
       start_date, day_of_week, time,
       branches!groups_branch_id_fkey(name),
       group_instructors!group_instructors_group_id_fkey(
         role,
         instructors!group_instructors_instructor_id_fkey(
           users!instructors_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )
       )`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (branchId) {
    if (Array.isArray(branchId)) {
      query = query.in('branch_id', branchId)
    } else {
      query = query.eq('branch_id', branchId)
    }
  }
  if (status)             query = query.eq('status', status)
  if (type)               query = query.eq('type', type)
  if (search)             query = query.ilike('name', `%${search}%`)
  if (restrictToGroupIds) query = query.in('id', restrictToGroupIds)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: GroupListItem[] = (data ?? []).map((row: any) => {
    const gis  = Array.isArray(row.group_instructors) ? row.group_instructors : []
    const lead = gis.find((gi: any) => gi.role === 'lead') ?? gis[0] ?? null
    const prof = lead?.instructors?.users?.profiles
    const instructorName = prof
      ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null
      : null

    return {
      id:              row.id,
      branch_id:       row.branch_id,
      name:            row.name,
      code:            row.code,
      type:            row.type,
      capacity:        row.capacity,
      status:          row.status,
      start_date:      row.start_date  ?? null,
      day_of_week:     row.day_of_week ?? null,
      time:            row.time        ?? null,
      branch_name:     row.branches?.name ?? '',
      student_count:   0,
      instructor_name: instructorName,
    }
  })

  const groupIds = items.map((g) => g.id)
  if (groupIds.length > 0) {
    const { data: gsRows } = await db
      .from('group_students')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('status', 'active')
    const countMap: Record<string, number> = {}
    for (const r of gsRows ?? []) {
      countMap[(r as any).group_id] = (countMap[(r as any).group_id] ?? 0) + 1
    }
    items.forEach((item) => { item.student_count = countMap[item.id] ?? 0 })
  }

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getGroup(id: string): Promise<Group | null> {
  const user = await getCurrentUser()
  const db   = createServiceClient()
  const { data, error } = await db
    .from('groups')
    .select(`*, branches!groups_branch_id_fkey(name)`)
    .eq('id', id)
    .single()

  if (error || !data) return null
  if (!user || !isBranchAccessible(user, (data as any).branch_id)) return null

  return {
    ...(data as any),
    branch_name: (data as any).branches?.name ?? '',
  } as Group
}

export async function listGroupEnrollments(groupId: string): Promise<GroupEnrollment[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('group_students')
    .select(
      `id, group_id, student_id, enrollment_type, status, joined_at, left_at, notes,
       students!group_students_student_id_fkey(
         student_code, emergency_contact,
         users!students_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('group_id', groupId)
    .order('joined_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row: any) => {
    const s  = row.students
    const ec = (s?.emergency_contact ?? {}) as Record<string, string>
    return {
      id:              row.id,
      group_id:        row.group_id,
      student_id:      row.student_id,
      enrollment_type: row.enrollment_type as 'primary' | 'secondary',
      status:          row.status,
      joined_at:       row.joined_at,
      left_at:         row.left_at,
      notes:           row.notes,
      student_email:   s?.users?.email ?? '',
      student_code:    s?.student_code ?? null,
      first_name:      s?.users?.profiles?.first_name ?? null,
      last_name:       s?.users?.profiles?.last_name  ?? null,
      phone:           s?.users?.phone ?? null,
      parent_phone_1:  ec.phone1 ?? null,
      parent_phone_2:  ec.phone2 ?? null,
    }
  }) as GroupEnrollment[]
}

export async function getGroupAcademicConfig(groupId: string): Promise<GroupAcademicConfig> {
  const db = createServiceClient()

  // total_sessions is fetched separately so the main query doesn't crash if the column is missing
  const [gcRes, leadGiRes, additionalGiRes] = await Promise.all([
    db.from('group_courses')
      .select(
        `id, course_id, instructor_id,
         courses!group_courses_course_id_fkey(title),
         instructors!group_courses_instructor_id_fkey(
           users!instructors_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )`
      )
      .eq('group_id', groupId)
      .eq('status', 'active')
      .maybeSingle(),
    db.from('group_instructors')
      .select(
        `instructor_id,
         instructors!group_instructors_instructor_id_fkey(
           users!instructors_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )`
      )
      .eq('group_id', groupId)
      .eq('role', 'lead')
      .maybeSingle(),
    db.from('group_instructors')
      .select(
        `instructor_id,
         instructors!group_instructors_instructor_id_fkey(
           users!instructors_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )`
      )
      .eq('group_id', groupId)
      .eq('role', 'additional'),
  ])

  const gc             = gcRes.data  as any
  const leadGi         = leadGiRes.data  as any
  const additionalGis  = (additionalGiRes.data ?? []) as any[]

  // Safe fetch of total_sessions (column may not exist if migration is pending)
  let totalSessions = 24
  if (gc?.id) {
    const { data: tsData, error: tsErr } = await db
      .from('group_courses')
      .select('total_sessions')
      .eq('id', gc.id)
      .maybeSingle()
    if (!tsErr && tsData) {
      totalSessions = (tsData as any).total_sessions ?? 24
    }
  }

  // Lead instructor: prefer group_courses.instructor_id, fall back to group_instructors lead row
  const instRow  = gc?.instructors ?? leadGi?.instructors
  const instProf = instRow?.users?.profiles
  const instName = instProf
    ? [instProf.first_name, instProf.last_name].filter(Boolean).join(' ') || null
    : null

  const additionalInstructors = additionalGis.map((gi: any) => {
    const p = gi?.instructors?.users?.profiles
    return {
      id:   gi.instructor_id as string,
      name: p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
    }
  })

  return {
    group_id:               groupId,
    group_course_id:        gc?.id                  ?? null,
    course_id:              gc?.course_id            ?? null,
    course_title:           gc?.courses?.title       ?? null,
    total_sessions:         totalSessions,
    instructor_id:          gc?.instructor_id ?? leadGi?.instructor_id ?? null,
    instructor_name:        instName,
    additional_instructors: additionalInstructors,
  }
}

export async function getGroupSchedules(groupId: string): Promise<GroupScheduleItem[]> {
  const db = createServiceClient()

  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) return []

  const { data, error } = await db
    .from('schedules')
    .select('id, group_course_id, scheduled_at, duration_minutes, type, delivery, status, topic, meeting_url, room')
    .eq('group_course_id', (gcRow as any).id)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:               row.id,
    group_course_id:  row.group_course_id,
    scheduled_at:     row.scheduled_at,
    duration_minutes: row.duration_minutes,
    type:             row.type,
    delivery:         row.delivery    ?? null,
    status:           row.status,
    topic:            row.topic       ?? null,
    meeting_url:      row.meeting_url ?? null,
    room:             row.room        ?? null,
  })) as GroupScheduleItem[]
}
