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
  SessionProgressItem,
  SessionRecording,
  ResourceLink,
  CourseModuleItem,
  TodayAction,
  StudentAttentionItem,
} from './types'

// ── Shared helper: resolve all group_courses the instructor is linked to ───────
// Checks BOTH group_courses.instructor_id (direct) and group_instructors (membership).
// Returns deduplicated gcIds and groupIds so all downstream queries are consistent.

interface GcContext {
  gcIds:    string[]
  groupIds: string[]
}

async function resolveGcContext(
  instructorId: string,
  db: ReturnType<typeof createServiceClient>
): Promise<GcContext> {
  const [{ data: giRows }, { data: gcDirect }] = await Promise.all([
    db.from('group_instructors').select('group_id').eq('instructor_id', instructorId),
    db.from('group_courses').select('id, group_id').eq('instructor_id', instructorId).eq('status', 'active'),
  ])

  const giGroupIds = (giRows ?? []).map((r: any) => r.group_id as string)

  let gcByGroup: { id: string; group_id: string }[] = []
  if (giGroupIds.length > 0) {
    const { data } = await db
      .from('group_courses')
      .select('id, group_id')
      .in('group_id', giGroupIds)
      .eq('status', 'active')
    gcByGroup = (data ?? []) as any[]
  }

  const gcMap = new Map<string, string>()
  for (const r of [...(gcDirect ?? []), ...gcByGroup]) {
    gcMap.set((r as any).id, (r as any).group_id)
  }
  const groupIdSet = new Set([...gcMap.values(), ...giGroupIds])

  return {
    gcIds:    [...gcMap.keys()],
    groupIds: [...groupIdSet],
  }
}

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

  // Source A: groups via group_instructors (may exist even if group_courses.instructor_id not synced)
  const { data: giRows } = await db
    .from('group_instructors')
    .select('group_id')
    .eq('instructor_id', instructorId)
  const giGroupIds = (giRows ?? []).map((r: any) => r.group_id as string)

  // Source B: group_courses directly assigned
  const { data: gcDirect } = await db
    .from('group_courses')
    .select('id, group_id')
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  // Source C: group_courses for groups found via group_instructors (covers un-synced assignments)
  let gcByGroup: { id: string; group_id: string }[] = []
  if (giGroupIds.length > 0) {
    const { data } = await db
      .from('group_courses')
      .select('id, group_id')
      .in('group_id', giGroupIds)
      .eq('status', 'active')
    gcByGroup = (data ?? []) as any[]
  }

  // Merge and deduplicate group_course rows
  const gcMap = new Map<string, string>() // gcId → groupId
  for (const r of [...(gcDirect ?? []), ...gcByGroup]) {
    gcMap.set((r as any).id, (r as any).group_id)
  }
  const gcIds = [...gcMap.keys()]

  // Deduplicate group IDs across all sources
  const groupIdSet = new Set<string>([...gcMap.values(), ...giGroupIds])
  const groupIds   = [...groupIdSet]
  const now        = new Date().toISOString()

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
    groupCount:       groupIds.length,
    studentCount:     (studentRes  as any).count ?? 0,
    upcomingSessions: (upcomingRes as any).count ?? 0,
    pendingReviews:   0,
  }
}

export async function getUpcomingSessionsForInstructor(
  instructorId: string,
  limit = 5
): Promise<InstructorSession[]> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  // Source A: group_courses directly assigned
  const { data: gcDirect } = await db
    .from('group_courses')
    .select(
      `id,
       group_id,
       groups!group_courses_group_id_fkey(name),
       courses!group_courses_course_id_fkey(title)`
    )
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  // Source B: group_courses via group_instructors membership
  const { data: giRows } = await db
    .from('group_instructors')
    .select('group_id')
    .eq('instructor_id', instructorId)
  const giGroupIds = (giRows ?? []).map((r: any) => r.group_id as string)

  let gcByGroup: any[] = []
  if (giGroupIds.length > 0) {
    const { data } = await db
      .from('group_courses')
      .select(
        `id,
         group_id,
         groups!group_courses_group_id_fkey(name),
         courses!group_courses_course_id_fkey(title)`
      )
      .in('group_id', giGroupIds)
      .eq('status', 'active')
    gcByGroup = data ?? []
  }

  // Deduplicate by group_course id
  const gcSeen = new Map<string, any>()
  for (const r of [...(gcDirect ?? []), ...gcByGroup]) {
    if (!gcSeen.has(r.id)) gcSeen.set(r.id, r)
  }
  const gcRows = [...gcSeen.values()]
  if (gcRows.length === 0) return []

  const gcIds = gcRows.map((r) => r.id as string)
  const gcMap = new Map<string, { group_id: string; group_name: string; course_title: string }>(
    gcRows.map((r) => [
      r.id,
      {
        group_id:     (r as any).group_id        ?? '',
        group_name:   (r as any).groups?.name    ?? '',
        course_title: (r as any).courses?.title  ?? '',
      },
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
    group_id:         gcMap.get(s.group_course_id)?.group_id     ?? '',
    group_name:       gcMap.get(s.group_course_id)?.group_name   ?? '',
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
  const { gcIds, groupIds } = await resolveGcContext(instructorId, db)

  // No groups at all — stop immediately.
  if (groupIds.length === 0) return []

  const now     = new Date().toISOString()
  const results: InstructorGroup[] = []

  // ── Path A: groups that have an active group_courses row ─────────────────
  if (gcIds.length > 0) {
    const { data: gcRows } = await db
      .from('group_courses')
      .select(
        `id, group_id, course_id,
         groups!group_courses_group_id_fkey(
           name, code, semester_id,
           branches!groups_branch_id_fkey(name),
           semesters!groups_semester_id_fkey(name, academic_year)
         ),
         courses!group_courses_course_id_fkey(title)`
      )
      .in('id', gcIds)
      .eq('status', 'active')

    if (gcRows && gcRows.length > 0) {
      const gcGroupIds = (gcRows as any[]).map((r) => r.group_id as string)
      const gcFullIds  = (gcRows as any[]).map((r) => r.id        as string)

      const [gsRes, schedRes] = await Promise.all([
        db.from('group_students').select('group_id').in('group_id', gcGroupIds).eq('status', 'active'),
        db.from('schedules')
          .select('group_course_id, status, scheduled_at')
          .in('group_course_id', gcFullIds)
          .order('scheduled_at', { ascending: true }),
      ])

      const studentMap:   Record<string, number> = {}
      const completedMap: Record<string, number> = {}
      const totalMap:     Record<string, number> = {}
      const nextMap:      Record<string, string> = {}

      for (const gs of gsRes.data ?? []) {
        const gid = (gs as any).group_id as string
        studentMap[gid] = (studentMap[gid] ?? 0) + 1
      }
      for (const s of schedRes.data ?? []) {
        const gcId = (s as any).group_course_id as string
        if ((s as any).status !== 'cancelled') totalMap[gcId] = (totalMap[gcId] ?? 0) + 1
        if ((s as any).status === 'completed')  completedMap[gcId] = (completedMap[gcId] ?? 0) + 1
        if (!nextMap[gcId] && (s as any).scheduled_at >= now && (s as any).status !== 'cancelled') {
          nextMap[gcId] = (s as any).scheduled_at as string
        }
      }

      for (const row of gcRows as any[]) {
        const sem     = row.groups?.semesters
        const semName = sem
          ? [sem.name ?? '', sem.academic_year ?? ''].filter(Boolean).join(' ').trim() || null
          : null
        results.push({
          group_id:           row.group_id,
          group_name:         row.groups?.name            ?? '',
          group_code:         row.groups?.code            ?? null,
          group_course_id:    row.id,
          course_id:          row.course_id,
          course_title:       row.courses?.title          ?? '',
          branch_name:        row.groups?.branches?.name  ?? '',
          student_count:      studentMap[row.group_id]    ?? 0,
          next_session_at:    nextMap[row.id]             ?? null,
          semester_id:        row.groups?.semester_id     ?? null,
          semester_name:      semName,
          completed_sessions: completedMap[row.id]        ?? 0,
          total_sessions:     totalMap[row.id]             ?? 0,
        })
      }
    }
  }

  // ── Path B: groups in group_instructors with no active group_courses row ──
  // A group can be assigned before any course is set up.
  // Semesters join excluded to avoid silent FK-hint failures; semester_name is null.
  const coveredIds   = new Set(results.map((r) => r.group_id))
  const uncoveredIds = groupIds.filter((id) => !coveredIds.has(id))

  if (uncoveredIds.length > 0) {
    const { data: groupRows } = await db
      .from('groups')
      .select('id, name, code, semester_id, branches!groups_branch_id_fkey(name)')
      .in('id', uncoveredIds)
      .is('deleted_at', null)

    const { data: gsRows } = await db
      .from('group_students')
      .select('group_id')
      .in('group_id', uncoveredIds)
      .eq('status', 'active')

    const studentMap: Record<string, number> = {}
    for (const gs of gsRows ?? []) {
      const gid = (gs as any).group_id as string
      studentMap[gid] = (studentMap[gid] ?? 0) + 1
    }

    for (const g of groupRows ?? []) {
      results.push({
        group_id:           (g as any).id,
        group_name:         (g as any).name               ?? '',
        group_code:         (g as any).code               ?? null,
        group_course_id:    '',
        course_id:          '',
        course_title:       '',
        branch_name:        (g as any).branches?.name     ?? '',
        student_count:      studentMap[(g as any).id]     ?? 0,
        next_session_at:    null,
        semester_id:        (g as any).semester_id        ?? null,
        semester_name:      null,
        completed_sessions: 0,
        total_sessions:     0,
      })
    }
  }

  return results
}

// ── Group Detail ──────────────────────────────────────────────────────────────

export async function getGroupForInstructor(
  groupId: string,
  instructorId: string
): Promise<GroupForInstructor | null> {
  const db = createServiceClient()

  const { data: gcRow } = await db
    .from('group_courses')
    .select(
      `id, course_id,
       groups!group_courses_group_id_fkey(
         name, branch_id, semester_id, day_of_week, time,
         branches!groups_branch_id_fkey(name)
       ),
       courses!group_courses_course_id_fkey(title)`
    )
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .eq('status', 'active')
    .maybeSingle()

  // ── Fallback: group assigned via group_instructors but no group_courses row ──
  if (!gcRow) {
    const { data: giRow } = await db
      .from('group_instructors')
      .select('group_id')
      .eq('group_id', groupId)
      .eq('instructor_id', instructorId)
      .maybeSingle()

    if (!giRow) return null

    const { data: gRow } = await db
      .from('groups')
      .select(`id, name, branch_id, semester_id, day_of_week, time,
               branches!groups_branch_id_fkey(name)`)
      .eq('id', groupId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!gRow) return null
    const g = gRow as any

    const { data: studentRes } = await db
      .from('group_students')
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
      .eq('status', 'active')

    const students = (studentRes ?? []).map((r: any) => {
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

    return {
      group_id:           groupId,
      group_course_id:    '',
      group_name:         g.name              ?? '',
      course_title:       '',
      branch_id:          g.branch_id         ?? '',
      branch_name:        g.branches?.name    ?? '',
      semester_id:        g.semester_id       ?? null,
      day_of_week:        g.day_of_week       ?? null,
      time:               g.time              ?? null,
      completed_sessions: 0,
      total_sessions:     0,
      students,
      sessions:           [],
    }
  }

  // ── Primary path: full data via group_courses ─────────────────────────────
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
    group_name:       gc.groups?.name   ?? '',
    course_title:     gc.courses?.title ?? '',
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes,
    type:             s.type,
    delivery:         s.delivery  ?? null,
    status:           s.status,
    topic:            s.topic     ?? null,
    notes:            s.notes     ?? null,
    attendance_count: attMap[s.id] ?? null,
  }))

  const completedSessions = sessions.filter((s) => s.status === 'completed').length

  return {
    group_id:           groupId,
    group_course_id:    gc.id,
    group_name:         gc.groups?.name          ?? '',
    course_title:       gc.courses?.title        ?? '',
    branch_id:          branchId,
    branch_name:        gc.groups?.branches?.name ?? '',
    semester_id:        gc.groups?.semester_id    ?? null,
    day_of_week:        gc.groups?.day_of_week    ?? null,
    time:               gc.groups?.time           ?? null,
    completed_sessions: completedSessions,
    total_sessions:     sessions.length,
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
      `id, group_course_id, branch_id, scheduled_at, started_at, ended_at,
       duration_minutes, type, delivery, meeting_url, room, status, topic, notes, resources_links,
       group_courses!schedules_group_course_id_fkey(
         group_id, instructor_id, course_id,
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
  const groupId  = gc?.group_id  as string
  const courseId = gc?.course_id as string | undefined
  const gcId     = s.group_course_id as string

  const [studentRes, attRes, recordingsRes, modulesRes, progressRes] = await Promise.all([
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
    db.from('session_recordings')
      .select('id, title, provider, external_url, visible_to_students, visible_to_parents, created_at')
      .eq('schedule_id', sessionId)
      .order('created_at', { ascending: true }),
    courseId
      ? db.from('course_modules').select('id, title').eq('course_id', courseId).is('deleted_at', null).order('order_index', { ascending: true }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    db.from('schedules')
      .select('id, scheduled_at, status, topic')
      .eq('group_course_id', gcId)
      .order('scheduled_at', { ascending: true }),
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

  const recordings: SessionRecording[] = (recordingsRes.data ?? []).map((r: any) => ({
    id:                  r.id,
    title:               r.title    ?? null,
    provider:            r.provider,
    external_url:        r.external_url,
    visible_to_students: r.visible_to_students,
    visible_to_parents:  r.visible_to_parents,
    created_at:          r.created_at,
  }))

  const courseModules: CourseModuleItem[] = (modulesRes.data ?? []).map((m: any) => ({
    id:    m.id,
    title: m.title,
  }))

  const allSessions = (progressRes.data ?? []) as any[]
  const progress: SessionProgressItem[] = allSessions.map((ps, idx) => ({
    id:           ps.id,
    scheduled_at: ps.scheduled_at,
    status:       ps.status,
    topic:        ps.topic ?? null,
    session_num:  idx + 1,
  }))
  const currentIdx = allSessions.findIndex((ps) => ps.id === sessionId)
  const currentNum = currentIdx >= 0 ? currentIdx + 1 : progress.length

  const resourcesRaw = (s as any).resources_links
  const resources_links: ResourceLink[] = Array.isArray(resourcesRaw) ? resourcesRaw : []

  return {
    id:               s.id,
    group_course_id:  s.group_course_id,
    group_id:         groupId,
    branch_id:        s.branch_id,
    scheduled_at:     s.scheduled_at,
    started_at:       (s as any).started_at  ?? null,
    ended_at:         (s as any).ended_at    ?? null,
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
    course_id:        courseId           ?? '',
    attendance,
    student_count:    (studentRes.data ?? []).length,
    recordings,
    resources_links,
    course_modules:   courseModules,
    progress,
    current_session_num: currentNum,
  }
}

// ── Homework Review ───────────────────────────────────────────────────────────

export async function listPendingSubmissions(
  instructorId: string,
  limit = 10
): Promise<PendingSubmissionItem[]> {
  const db = createServiceClient()
  const { gcIds } = await resolveGcContext(instructorId, db)
  if (gcIds.length === 0) return []

  const { data: gcRows } = await db
    .from('group_courses')
    .select(
      `id, group_id,
       groups!group_courses_group_id_fkey(name),
       courses!group_courses_course_id_fkey(id, title)`
    )
    .in('id', gcIds)
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

  return (subRows ?? []).slice(0, limit).map((row: any) => {
    const p        = row.students?.users?.profiles
    const asgn     = assignMap.get(row.assignment_id)
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

// ── Today's Actions ───────────────────────────────────────────────────────────

export async function getTodayActions(instructorId: string): Promise<TodayAction[]> {
  const db = createServiceClient()
  const { gcIds } = await resolveGcContext(instructorId, db)
  if (gcIds.length === 0) return []

  // Build group_id and group_name lookup for URL construction
  const { data: gcMeta } = await db
    .from('group_courses')
    .select('id, group_id, groups!group_courses_group_id_fkey(name)')
    .in('id', gcIds)
  const gcGroupMap = new Map<string, { groupId: string; groupName: string }>(
    (gcMeta ?? []).map((r: any) => [r.id as string, { groupId: r.group_id as string, groupName: r.groups?.name ?? '' }])
  )

  // Today's date range (UTC)
  const now   = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))

  const { data: todaySess } = await db
    .from('schedules')
    .select('id, group_course_id, status, topic, notes')
    .in('group_course_id', gcIds)
    .gte('scheduled_at', start.toISOString())
    .lte('scheduled_at', end.toISOString())
    .neq('status', 'cancelled')

  // Batch fetch attendance counts for completed sessions
  const completedIds = (todaySess ?? [])
    .filter((s: any) => s.status === 'completed')
    .map((s: any) => s.id as string)
  const attCounts: Record<string, number> = {}
  if (completedIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records')
      .select('schedule_id')
      .in('schedule_id', completedIds)
    for (const a of attRows ?? []) {
      const sid = (a as any).schedule_id as string
      attCounts[sid] = (attCounts[sid] ?? 0) + 1
    }
  }

  const actions: TodayAction[] = []
  for (const sess of todaySess ?? []) {
    const gc   = gcGroupMap.get((sess as any).group_course_id)
    if (!gc) continue
    const href = `/portal/instructor/groups/${gc.groupId}/sessions/${(sess as any).id}`

    if ((sess as any).status === 'scheduled') {
      actions.push({ type: 'start_session', label: "Start today's session", detail: gc.groupName, href })
    } else if ((sess as any).status === 'ongoing') {
      actions.push({ type: 'complete_attendance', label: 'Session in progress — complete attendance', detail: gc.groupName, href })
    } else if ((sess as any).status === 'completed') {
      if (!attCounts[(sess as any).id]) {
        actions.push({ type: 'complete_attendance', label: 'Complete attendance', detail: gc.groupName, href })
      }
      if (!(sess as any).topic && !(sess as any).notes) {
        actions.push({ type: 'add_notes', label: 'Add session notes', detail: gc.groupName, href })
      }
    }
  }

  // Pending homework reviews — add one consolidated action if any exist
  const pending = await listPendingSubmissions(instructorId, 1)
  if (pending.length > 0) {
    // Get full count without limit for the label
    const allPending = await listPendingSubmissions(instructorId, 999)
    const n = allPending.length
    actions.push({
      type:   'review_homework',
      label:  `Review ${n} homework submission${n > 1 ? 's' : ''}`,
      detail: '',
      href:   '/portal/instructor/homework',
    })
  }

  return actions
}

// ── Students Requiring Attention ──────────────────────────────────────────────

export async function getStudentsRequiringAttention(
  instructorId: string,
  limit = 5
): Promise<StudentAttentionItem[]> {
  const db = createServiceClient()
  const { gcIds } = await resolveGcContext(instructorId, db)
  if (gcIds.length === 0) return []

  // Build group name lookup
  const { data: gcMeta } = await db
    .from('group_courses')
    .select('id, group_id, groups!group_courses_group_id_fkey(name)')
    .in('id', gcIds)
  const gcToGroup  = new Map<string, string>((gcMeta ?? []).map((r: any) => [r.id as string, r.group_id as string]))
  const groupNames = new Map<string, string>((gcMeta ?? []).map((r: any) => [r.group_id as string, (r as any).groups?.name ?? '']))

  // All session ids for this instructor's groups
  const { data: schedRows } = await db
    .from('schedules')
    .select('id, group_course_id')
    .in('group_course_id', gcIds)
    .eq('status', 'completed')
  const schedIds     = (schedRows ?? []).map((s: any) => s.id as string)
  const schedToGroup = new Map<string, string>(
    (schedRows ?? []).map((s: any) => [s.id as string, gcToGroup.get((s as any).group_course_id) ?? ''])
  )
  if (schedIds.length === 0) return []

  // Absence records
  const { data: absRows } = await db
    .from('attendance_records')
    .select('student_id, schedule_id')
    .in('schedule_id', schedIds)
    .eq('status', 'absent')

  // Aggregate absences per student-group pair
  const absMap = new Map<string, { count: number; groupId: string }>()
  for (const a of absRows ?? []) {
    const sid = (a as any).student_id as string
    const gid = schedToGroup.get((a as any).schedule_id) ?? ''
    const key = `${sid}:${gid}`
    const cur = absMap.get(key) ?? { count: 0, groupId: gid }
    absMap.set(key, { count: cur.count + 1, groupId: gid })
  }

  const flagged = [...absMap.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, limit)

  if (flagged.length === 0) return []

  const studentIds = flagged.map(([key]) => key.split(':')[0])
  const { data: studRows } = await db
    .from('students')
    .select(`id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
    .in('id', studentIds)
    .is('deleted_at', null)
  const nameMap = new Map<string, string>(
    (studRows ?? []).map((s: any) => {
      const p = s.users?.profiles
      return [s.id as string, [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Unknown']
    })
  )

  return flagged.map(([key, { count, groupId }]) => {
    const studentId = key.split(':')[0]
    return {
      student_id:    studentId,
      student_name:  nameMap.get(studentId)      ?? 'Unknown',
      group_id:      groupId,
      group_name:    groupNames.get(groupId)     ?? '',
      absence_count: count,
      reason:        `${count} absence${count > 1 ? 's' : ''}`,
      href:          groupId ? `/portal/instructor/groups/${groupId}/students/${studentId}` : '#',
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

  // Verify instructor has this group — try group_courses first, fall back to group_instructors
  // (forming groups have no group_courses row but the instructor is still a valid owner)
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) {
    const { data: giRow } = await db
      .from('group_instructors')
      .select('group_id')
      .eq('group_id', groupId)
      .eq('instructor_id', instructorId)
      .maybeSingle()
    if (!giRow) return null
  }

  // Verify student is in the group
  const { data: gsRow } = await db
    .from('group_students')
    .select('id')
    .eq('group_id', groupId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()

  if (!gsRow) return null

  // For forming groups (no group_courses row), there are no schedules yet — attendance is empty
  const gcId = (gcRow as any)?.id ?? null

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
    gcId
      ? db.from('schedules').select('id').eq('group_course_id', gcId)
      : Promise.resolve({ data: [], error: null }),
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
