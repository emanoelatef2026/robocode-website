import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  InstructorRecord,
  InstructorGroup,
  InstructorSession,
  SessionDetail,
  PendingSubmissionItem,
  StudentProfileForInstructor,
  StudentNote,
  InstructorDashboardStats,
  GroupForInstructor,
} from './types'

// ── Resolve instructor record from auth user id ───────────────────────────────

export async function getInstructorByUserId(userId: string): Promise<InstructorRecord | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('instructors')
    .select(
      `id, user_id, branch_id,
       users!instructors_user_id_fkey(
         email,
         profiles!profiles_user_id_fkey(first_name, last_name)
       )`
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null
  const row = data as any
  return {
    id:         row.id,
    user_id:    row.user_id,
    branch_id:  row.branch_id,
    email:      row.users?.email ?? '',
    first_name: row.users?.profiles?.first_name ?? null,
    last_name:  row.users?.profiles?.last_name  ?? null,
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getInstructorDashboardStats(
  instructorId: string
): Promise<InstructorDashboardStats> {
  const db = createServiceClient()

  const { data: gcRows } = await db
    .from('group_courses')
    .select('id, group_id')
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  const gcIds    = (gcRows ?? []).map((r: any) => r.id        as string)
  const groupIds = (gcRows ?? []).map((r: any) => r.group_id  as string)
  const now      = new Date().toISOString()

  const [studentRes, upcomingRes] = await Promise.all([
    groupIds.length > 0
      ? db.from('group_students')
          .select('id', { count: 'exact', head: true })
          .in('group_id', groupIds)
          .eq('status', 'active')
      : Promise.resolve({ count: 0, error: null }),
    gcIds.length > 0
      ? db.from('schedules')
          .select('id', { count: 'exact', head: true })
          .in('group_course_id', gcIds)
          .gte('scheduled_at', now)
          .neq('status', 'cancelled')
      : Promise.resolve({ count: 0, error: null }),
  ])

  return {
    groupCount:       gcIds.length,
    studentCount:     (studentRes  as any).count ?? 0,
    upcomingSessions: (upcomingRes as any).count ?? 0,
    pendingReviews:   0,  // set separately by listPendingSubmissions().length
  }
}

export async function getUpcomingSessionsForInstructor(
  instructorId: string,
  limit = 5
): Promise<InstructorSession[]> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const { data: gcRows } = await db
    .from('group_courses')
    .select(
      `id,
       groups!group_courses_group_id_fkey(name),
       courses!group_courses_course_id_fkey(title)`
    )
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  if (!gcRows || gcRows.length === 0) return []

  const gcIds = (gcRows as any[]).map((r) => r.id as string)
  const gcMap = new Map<string, { group_name: string; course_title: string }>(
    (gcRows as any[]).map((r) => [
      r.id,
      { group_name: r.groups?.name ?? '', course_title: r.courses?.title ?? '' },
    ])
  )

  const { data: sessRows } = await db
    .from('schedules')
    .select('id, group_course_id, scheduled_at, duration_minutes, type, delivery, status, topic')
    .in('group_course_id', gcIds)
    .gte('scheduled_at', now)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  return (sessRows ?? []).map((s: any) => ({
    id:               s.id,
    group_course_id:  s.group_course_id,
    group_name:       gcMap.get(s.group_course_id)?.group_name  ?? '',
    course_title:     gcMap.get(s.group_course_id)?.course_title ?? '',
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes,
    type:             s.type,
    delivery:         s.delivery   ?? null,
    status:           s.status,
    topic:            s.topic      ?? null,
    notes:            null,
    attendance_count: null,
  }))
}

// ── My Groups ─────────────────────────────────────────────────────────────────

export async function listInstructorGroups(instructorId: string): Promise<InstructorGroup[]> {
  const db = createServiceClient()

  const { data: gcRows, error } = await db
    .from('group_courses')
    .select(
      `id, group_id, course_id,
       groups!group_courses_group_id_fkey(name, code, semester_id),
       courses!group_courses_course_id_fkey(title)`
    )
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  if (error || !gcRows || gcRows.length === 0) return []

  const groupIds = (gcRows as any[]).map((r) => r.group_id as string)
  const gcIds    = (gcRows as any[]).map((r) => r.id        as string)

  // Student counts per group
  const studentMap: Record<string, number> = {}
  if (groupIds.length > 0) {
    const { data: gsRows } = await db
      .from('group_students')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('status', 'active')
    for (const gs of gsRows ?? []) {
      const gid = (gs as any).group_id as string
      studentMap[gid] = (studentMap[gid] ?? 0) + 1
    }
  }

  // Next session per group_course
  const nextMap: Record<string, string> = {}
  if (gcIds.length > 0) {
    const now = new Date().toISOString()
    const { data: schedRows } = await db
      .from('schedules')
      .select('group_course_id, scheduled_at')
      .in('group_course_id', gcIds)
      .gte('scheduled_at', now)
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true })
    for (const s of schedRows ?? []) {
      const gcId = (s as any).group_course_id as string
      if (!nextMap[gcId]) nextMap[gcId] = (s as any).scheduled_at as string
    }
  }

  return (gcRows as any[]).map((row) => ({
    group_id:        row.group_id,
    group_name:      row.groups?.name     ?? '',
    group_code:      row.groups?.code     ?? null,
    group_course_id: row.id,
    course_id:       row.course_id,
    course_title:    row.courses?.title   ?? '',
    student_count:   studentMap[row.group_id] ?? 0,
    next_session_at: nextMap[row.id] ?? null,
    semester_id:     row.groups?.semester_id  ?? null,
  }))
}

// ── Group Detail ──────────────────────────────────────────────────────────────

export async function getGroupForInstructor(
  groupId: string,
  instructorId: string
): Promise<GroupForInstructor | null> {
  const db = createServiceClient()

  const { data: gcRow, error: gcErr } = await db
    .from('group_courses')
    .select(
      `id, course_id,
       groups!group_courses_group_id_fkey(name, branch_id, semester_id),
       courses!group_courses_course_id_fkey(title)`
    )
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .eq('status', 'active')
    .maybeSingle()

  if (gcErr || !gcRow) return null
  const gc       = gcRow as any
  const branchId = gc.groups?.branch_id ?? ''

  const [studentRes, sessRes] = await Promise.all([
    db.from('group_students')
      .select(
        `student_id, enrollment_type,
         students!group_students_student_id_fkey(
           users!students_user_id_fkey(
             email,
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )`
      )
      .eq('group_id', groupId)
      .eq('status', 'active'),
    db.from('schedules')
      .select('id, group_course_id, scheduled_at, duration_minutes, type, delivery, status, topic, notes')
      .eq('group_course_id', gc.id)
      .order('scheduled_at', { ascending: false })
      .limit(50),
  ])

  // Attendance counts per session
  const sessIds = (sessRes.data ?? []).map((s: any) => s.id as string)
  const attMap: Record<string, number> = {}
  if (sessIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records')
      .select('schedule_id')
      .in('schedule_id', sessIds)
    for (const a of attRows ?? []) {
      const sid = (a as any).schedule_id as string
      attMap[sid] = (attMap[sid] ?? 0) + 1
    }
  }

  const students = (studentRes.data ?? []).map((r: any) => {
    const u = r.students?.users
    const p = u?.profiles
    return {
      student_id:      r.student_id,
      first_name:      p?.first_name ?? null,
      last_name:       p?.last_name  ?? null,
      email:           u?.email      ?? '',
      enrollment_type: r.enrollment_type as 'primary' | 'secondary',
    }
  })

  const sessions: InstructorSession[] = (sessRes.data ?? []).map((s: any) => ({
    id:               s.id,
    group_course_id:  s.group_course_id,
    group_name:       gc.groups?.name    ?? '',
    course_title:     gc.courses?.title  ?? '',
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes,
    type:             s.type,
    delivery:         s.delivery  ?? null,
    status:           s.status,
    topic:            s.topic     ?? null,
    notes:            s.notes     ?? null,
    attendance_count: attMap[s.id] ?? null,
  }))

  return {
    group_id:        groupId,
    group_course_id: gc.id,
    group_name:      gc.groups?.name   ?? '',
    course_title:    gc.courses?.title ?? '',
    branch_id:       branchId,
    semester_id:     gc.groups?.semester_id ?? null,
    students,
    sessions,
  }
}

// ── Session Detail + Attendance ───────────────────────────────────────────────

export async function getSessionDetail(
  sessionId:    string,
  instructorId: string
): Promise<SessionDetail | null> {
  const db = createServiceClient()

  const { data: sessRow, error: sessErr } = await db
    .from('schedules')
    .select(
      `id, group_course_id, branch_id, scheduled_at, duration_minutes,
       type, delivery, meeting_url, room, status, topic, notes,
       group_courses!schedules_group_course_id_fkey(
         group_id, instructor_id,
         groups!group_courses_group_id_fkey(name),
         courses!group_courses_course_id_fkey(title)
       )`
    )
    .eq('id', sessionId)
    .single()

  if (sessErr || !sessRow) return null

  const s  = sessRow as any
  const gc = s.group_courses

  // Verify this session belongs to this instructor
  if (gc?.instructor_id !== instructorId) return null
  const groupId = gc?.group_id as string

  const [studentRes, attRes] = await Promise.all([
    db.from('group_students')
      .select(
        `student_id,
         students!group_students_student_id_fkey(
           users!students_user_id_fkey(
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         )`
      )
      .eq('group_id', groupId)
      .eq('status', 'active'),
    db.from('attendance_records')
      .select('id, student_id, status, late_minutes, notes')
      .eq('schedule_id', sessionId),
  ])

  const attMap = new Map<string, any>()
  for (const a of attRes.data ?? []) {
    attMap.set((a as any).student_id as string, a)
  }

  const attendance = (studentRes.data ?? []).map((r: any) => {
    const p   = r.students?.users?.profiles
    const rec = attMap.get(r.student_id)
    return {
      record_id:    rec?.id           ?? null,
      student_id:   r.student_id,
      student_name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Unknown',
      status:       rec?.status       ?? null,
      late_minutes: rec?.late_minutes ?? null,
      notes:        rec?.notes        ?? null,
    }
  })

  return {
    id:               s.id,
    group_course_id:  s.group_course_id,
    group_id:         groupId,
    branch_id:        s.branch_id,
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes,
    type:             s.type,
    delivery:         s.delivery    ?? null,
    meeting_url:      s.meeting_url ?? null,
    room:             s.room        ?? null,
    status:           s.status,
    topic:            s.topic       ?? null,
    notes:            s.notes       ?? null,
    group_name:       gc?.groups?.name   ?? '',
    course_title:     gc?.courses?.title ?? '',
    attendance,
    student_count:    (studentRes.data ?? []).length,
  }
}

// ── Homework Review ───────────────────────────────────────────────────────────

export async function listPendingSubmissions(instructorId: string): Promise<PendingSubmissionItem[]> {
  const db = createServiceClient()

  const { data: gcRows } = await db
    .from('group_courses')
    .select(
      `id, group_id,
       groups!group_courses_group_id_fkey(name),
       courses!group_courses_course_id_fkey(id, title)`
    )
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  if (!gcRows || gcRows.length === 0) return []

  const courseIds  = (gcRows as any[]).map((gc) => gc.courses?.id  as string).filter(Boolean)
  const groupNameByCourse = new Map<string, string>(
    (gcRows as any[]).map((gc) => [gc.courses?.id as string, gc.groups?.name as string ?? ''])
  )

  if (!courseIds.length) return []

  const { data: moduleRows } = await db
    .from('course_modules')
    .select('id, course_id')
    .in('course_id', courseIds)
    .is('deleted_at', null)

  const moduleIds     = (moduleRows ?? []).map((m: any) => m.id as string)
  const courseByModule = new Map<string, string>(
    (moduleRows ?? []).map((m: any) => [m.id as string, m.course_id as string])
  )

  if (!moduleIds.length) return []

  const { data: lessonRows } = await db
    .from('lessons')
    .select('id, module_id')
    .in('module_id', moduleIds)
    .is('deleted_at', null)

  const lessonIds = (lessonRows ?? []).map((l: any) => l.id as string)

  const orParts = [`module_id.in.(${moduleIds.join(',')})`]
  if (lessonIds.length > 0) orParts.push(`lesson_id.in.(${lessonIds.join(',')})`)

  const { data: assignRows } = await db
    .from('assignments')
    .select(
      `id, title, due_at,
       course_modules!assignments_module_id_fkey(course_id, title)`
    )
    .eq('status', 'published')
    .is('deleted_at', null)
    .or(orParts.join(','))

  if (!assignRows || assignRows.length === 0) return []

  const assignIds = (assignRows as any[]).map((a) => a.id as string)
  const assignMap = new Map<string, any>((assignRows as any[]).map((a) => [a.id, a]))

  const { data: subRows } = await db
    .from('submissions')
    .select(
      `id, assignment_id, student_id, submitted_at, status, is_late, resubmission_count,
       students!submissions_student_id_fkey(
         users!students_user_id_fkey(
           profiles!profiles_user_id_fkey(first_name, last_name)
         )
       )`
    )
    .in('assignment_id', assignIds)
    .in('status', ['submitted', 'resubmitted'])
    .order('submitted_at', { ascending: true })

  return (subRows ?? []).map((row: any) => {
    const p       = row.students?.users?.profiles
    const asgn    = assignMap.get(row.assignment_id)
    const courseId = asgn?.course_modules?.course_id
    return {
      submission_id:      row.id,
      assignment_id:      row.assignment_id,
      assignment_title:   asgn?.title ?? '',
      course_title:       asgn?.course_modules?.title ?? null,
      group_name:         courseId ? (groupNameByCourse.get(courseId) ?? null) : null,
      student_id:         row.student_id,
      student_name:       [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Unknown',
      submitted_at:       row.submitted_at,
      status:             row.status,
      is_late:            row.is_late,
      resubmission_count: row.resubmission_count,
    }
  })
}

// ── Student Profile (instructor view) ────────────────────────────────────────

export async function getStudentProfileForInstructor(
  studentId:    string,
  groupId:      string,
  instructorId: string,
  userId:       string     // auth user id — used for notes authorship
): Promise<StudentProfileForInstructor | null> {
  const db = createServiceClient()

  // Verify instructor has this group
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) return null

  // Verify student is in the group
  const { data: gsRow } = await db
    .from('group_students')
    .select('id')
    .eq('group_id', groupId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()

  if (!gsRow) return null

  const [studentRes, groupRes, schedRes, noteRes] = await Promise.all([
    db.from('students')
      .select(
        `id, user_id,
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`
      )
      .eq('id', studentId)
      .is('deleted_at', null)
      .single(),
    db.from('groups').select('name').eq('id', groupId).single(),
    db.from('schedules').select('id').eq('group_course_id', (gcRow as any).id),
    db.from('student_notes')
      .select(
        `id, content, is_private, schedule_id, created_at, updated_at,
         schedules!student_notes_schedule_id_fkey(topic)`
      )
      .eq('student_id', studentId)
      .eq('author_id', userId)
      .order('created_at', { ascending: false }),
  ])

  if (studentRes.error || !studentRes.data) return null

  const sRow = studentRes.data as any
  const u    = sRow.users
  const p    = u?.profiles

  // Attendance summary
  const schedIds = (schedRes.data ?? []).map((s: any) => s.id as string)
  let total = 0, present = 0, absent = 0, late = 0
  if (schedIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records')
      .select('status')
      .eq('student_id', studentId)
      .in('schedule_id', schedIds)

    for (const a of attRows ?? []) {
      total++
      const st = (a as any).status as string
      if (st === 'present')       present++
      else if (st === 'absent')   absent++
      else if (st === 'late')     late++
    }
  }

  const notes: StudentNote[] = (noteRes.data ?? []).map((n: any) => ({
    id:             n.id,
    content:        n.content,
    is_private:     n.is_private,
    schedule_id:    n.schedule_id   ?? null,
    schedule_topic: (n.schedules as any)?.topic ?? null,
    created_at:     n.created_at,
    updated_at:     n.updated_at,
  }))

  return {
    student_id:         studentId,
    user_id:            sRow.user_id,
    first_name:         p?.first_name ?? null,
    last_name:          p?.last_name  ?? null,
    email:              u?.email      ?? '',
    group_id:           groupId,
    group_name:         (groupRes.data as any)?.name ?? '',
    attendance_total:   total,
    attendance_present: present,
    attendance_absent:  absent,
    attendance_late:    late,
    notes,
  }
}
