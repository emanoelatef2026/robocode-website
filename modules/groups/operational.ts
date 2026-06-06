import 'server-only'
import { createServiceClient }      from '@/lib/supabase/service'
import { getGroupMetrics }          from '@/modules/tl-dashboard/queries'
import { getInstructorFilterOptions } from '@/modules/query-standards'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GroupOperationalRow {
  group_id:              string
  branch_id:             string
  branch_name:           string
  name:                  string
  code:                  string | null
  type:                  string
  status:                string
  capacity:              number | null
  student_count:         number
  capacity_pct:          number | null
  day_of_week:           string | null
  start_time:            string | null
  duration_minutes:      number | null
  start_date:            string | null
  end_date:              string | null
  meeting_link:          string | null
  notes:                 string | null
  course_id:             string | null
  course_name:           string | null
  lead_instructor_id:    string | null
  lead_instructor_name:  string | null
  asst_instructor_id:    string | null
  asst_instructor_name:  string | null
  has_instructor:        boolean
  has_course:            boolean
  attendance_avg:        number
  assignment_avg:        number
  portfolio_avg:         number
  health_score:          number
  is_low_attendance:     boolean
  is_low_capacity:       boolean
  is_overloaded:         boolean
  starts_soon:           boolean
  enrolled_students:     EnrolledStudentBasic[]
}

export interface EnrolledStudentBasic {
  student_id:   string
  student_name: string
  student_code: string | null
  status:       string
}

export interface GroupStudentOption {
  student_id:         string
  student_name:       string
  student_code:       string | null
  age:                number | null
  branch_id:          string
  branch_name:        string
  phone:              string | null
  parent_phone:       string | null
  group_name:         string | null
  attendance_pct:     number | null
  sessions_remaining: number | null
}

export interface GroupFormOptions {
  branches:    { id: string; name: string }[]
  courses:     { id: string; title: string }[]
  instructors: { id: string; name: string }[]
}

// ── Main operational list ──────────────────────────────────────────────────────

export async function listGroupsOperational(branchIds: string[]): Promise<GroupOperationalRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data: groups } = await db
    .from('groups')
    .select(`
      id, branch_id, name, code, type, capacity, status,
      start_date, day_of_week, time, notes,
      branches!groups_branch_id_fkey(name),
      group_instructors!group_instructors_group_id_fkey(
        instructor_id, role,
        instructors!group_instructors_instructor_id_fkey(
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      )
    `)
    .in('branch_id', branchIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const groupRows = (groups ?? []) as any[]
  if (!groupRows.length) return []

  const groupIds = groupRows.map((g: any) => g.id as string)

  const [gcResult, enrolledResult, schedResult] = await Promise.all([
    db.from('group_courses')
      .select(`group_id, course_id, courses!group_courses_course_id_fkey(title)`)
      .in('group_id', groupIds)
      .eq('status', 'active'),
    db.from('group_students')
      .select(`
        group_id, student_id, status,
        students!group_students_student_id_fkey(
          student_code,
          users!students_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      `)
      .in('group_id', groupIds)
      .eq('status', 'active'),
    db.from('groups')
      .select('id, duration_minutes, end_date, meeting_link')
      .in('id', groupIds),
  ])

  const courseMap = new Map<string, { course_id: string; course_name: string }>()
  for (const gc of (gcResult.data ?? []) as any[]) {
    courseMap.set(gc.group_id, { course_id: gc.course_id, course_name: gc.courses?.title ?? '' })
  }

  const studentCountMap = new Map<string, number>()
  const enrolledMap     = new Map<string, EnrolledStudentBasic[]>()
  for (const gs of (enrolledResult.data ?? []) as any[]) {
    studentCountMap.set(gs.group_id, (studentCountMap.get(gs.group_id) ?? 0) + 1)
    const prof = gs.students?.users?.profiles ?? {}
    const name = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
    const arr  = enrolledMap.get(gs.group_id) ?? []
    arr.push({
      student_id:   gs.student_id,
      student_name: name,
      student_code: gs.students?.student_code ?? null,
      status:       gs.status,
    })
    enrolledMap.set(gs.group_id, arr)
  }

  // schedResult is null-safe: if migration 0057 hasn't run, data is null and all groups get null for new fields
  const schedMap = new Map<string, { duration_minutes: number | null; end_date: string | null; meeting_link: string | null }>()
  for (const s of (schedResult.data ?? []) as any[]) {
    schedMap.set(s.id as string, {
      duration_minutes: s.duration_minutes ?? null,
      end_date:         s.end_date         ?? null,
      meeting_link:     s.meeting_link     ?? null,
    })
  }

  const metricsMap = await getGroupMetrics(groupIds)

  const now       = new Date()
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return groupRows.map((g: any): GroupOperationalRow => {
    const gis      = Array.isArray(g.group_instructors) ? g.group_instructors : []
    const lead     = gis.find((gi: any) => gi.role === 'lead') ?? null
    const asst     = gis.find((gi: any) => gi.role === 'additional') ?? null
    const leadProf = lead?.instructors?.users?.profiles
    const asstProf = asst?.instructors?.users?.profiles
    const leadName = leadProf ? [leadProf.first_name, leadProf.last_name].filter(Boolean).join(' ') || null : null
    const asstName = asstProf ? [asstProf.first_name, asstProf.last_name].filter(Boolean).join(' ') || null : null

    const courseInfo   = courseMap.get(g.id)
    const studentCount = studentCountMap.get(g.id) ?? 0
    const capacityPct  = g.capacity ? Math.round((studentCount / g.capacity) * 100) : null
    const metrics      = metricsMap.get(g.id)
    const sched        = schedMap.get(g.id)

    let startsSoon = false
    if (g.start_date) {
      const sd = new Date(g.start_date)
      startsSoon = sd >= now && sd <= inOneWeek
    }

    return {
      group_id:             g.id,
      branch_id:            g.branch_id,
      branch_name:          (g.branches as any)?.name ?? '',
      name:                 g.name,
      code:                 g.code ?? null,
      type:                 g.type,
      status:               g.status,
      capacity:             g.capacity ?? null,
      student_count:        studentCount,
      capacity_pct:         capacityPct,
      day_of_week:          g.day_of_week ?? null,
      start_time:           g.time ?? null,
      duration_minutes:     sched?.duration_minutes ?? null,
      start_date:           g.start_date ?? null,
      end_date:             sched?.end_date ?? null,
      meeting_link:         sched?.meeting_link ?? null,
      notes:                g.notes ?? null,
      course_id:            courseInfo?.course_id ?? null,
      course_name:          courseInfo?.course_name ?? null,
      lead_instructor_id:   lead?.instructor_id ?? null,
      lead_instructor_name: leadName,
      asst_instructor_id:   asst?.instructor_id ?? null,
      asst_instructor_name: asstName,
      has_instructor:       !!leadName,
      has_course:           !!courseInfo,
      attendance_avg:       metrics?.attendance_avg ?? 0,
      assignment_avg:       metrics?.assignment_avg ?? 0,
      portfolio_avg:        metrics?.portfolio_avg  ?? 0,
      health_score:         metrics?.health_score   ?? 0,
      is_low_attendance:    studentCount > 0 && (metrics?.attendance_avg ?? 100) < 60,
      is_low_capacity:      capacityPct !== null && capacityPct < 50 && studentCount > 0,
      is_overloaded:        capacityPct !== null && capacityPct >= 90,
      starts_soon:          startsSoon,
      enrolled_students:    enrolledMap.get(g.id) ?? [],
    }
  })
}

// ── Form options (for the create/edit modal) ───────────────────────────────────

export async function getGroupFormOptions(branchIds: string[]): Promise<GroupFormOptions> {
  if (!branchIds.length) return { branches: [], courses: [], instructors: [] }
  const db = createServiceClient()

  const [branchRes, courseRes, instructors] = await Promise.all([
    db.from('branches').select('id, name').in('id', branchIds).order('name'),
    db.from('courses').select('id, title').order('title'),
    getInstructorFilterOptions(branchIds),
  ])

  return {
    branches:    (branchRes.data ?? []) as { id: string; name: string }[],
    courses:     (courseRes.data ?? []).map((c: any) => ({ id: c.id as string, title: c.title as string })),
    instructors,
  }
}

// ── Student picker for group allocation ───────────────────────────────────────

export async function getGroupStudentOptions(branchIds: string[], excludeGroupId?: string): Promise<GroupStudentOption[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data: students } = await db
    .from('students')
    .select(`
      id, student_code, age, date_of_birth, branch_id,
      users!students_user_id_fkey(
        phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      ),
      branches!students_branch_id_fkey(name)
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(600)

  const stuRows = (students ?? []) as any[]
  if (!stuRows.length) return []

  const studentIds = stuRows.map((s: any) => s.id as string)

  // Batch-load all operational data in parallel — no N+1 queries.
  const [gsResult, guardianResult, attendanceResult, enrollmentResult] = await Promise.all([
    db.from('group_students')
      .select('student_id, group_id, groups!group_students_group_id_fkey(name)')
      .in('student_id', studentIds)
      .eq('status', 'active'),
    db.from('student_guardians')
      .select('student_id, phone1')
      .in('student_id', studentIds)
      .not('phone1', 'is', null)
      .limit(1200),
    db.from('attendance_records')
      .select('student_id, status')
      .in('student_id', studentIds),
    db.from('student_enrollments')
      .select('student_id, remaining_sessions')
      .in('student_id', studentIds)
      .eq('status', 'ACTIVE'),
  ])

  // Current group map
  const groupMap = new Map<string, string>()
  for (const gs of (gsResult.data ?? []) as any[]) {
    if (excludeGroupId && gs.group_id === excludeGroupId) continue
    if (!groupMap.has(gs.student_id)) {
      groupMap.set(gs.student_id, gs.groups?.name ?? '')
    }
  }

  // Guardian phone map — first phone1 per student
  const guardianPhoneMap = new Map<string, string>()
  for (const g of (guardianResult.data ?? []) as any[]) {
    if (!guardianPhoneMap.has(g.student_id) && g.phone1) {
      guardianPhoneMap.set(g.student_id as string, g.phone1 as string)
    }
  }

  // Attendance % map — count present/late as attended; require ≥3 records to show
  const attMap = new Map<string, { present: number; total: number }>()
  for (const a of (attendanceResult.data ?? []) as any[]) {
    const entry = attMap.get(a.student_id) ?? { present: 0, total: 0 }
    entry.total++
    if (a.status === 'present' || a.status === 'late') entry.present++
    attMap.set(a.student_id as string, entry)
  }

  // Sessions remaining map — sum across all active enrollments
  const sessMap = new Map<string, number>()
  for (const e of (enrollmentResult.data ?? []) as any[]) {
    if (e.remaining_sessions != null) {
      sessMap.set(e.student_id as string, (sessMap.get(e.student_id) ?? 0) + (e.remaining_sessions as number))
    }
  }

  return stuRows.map((s: any): GroupStudentOption => {
    const prof   = s.users?.profiles ?? {}
    const att    = attMap.get(s.id)
    const attPct = att && att.total >= 3 ? Math.round((att.present / att.total) * 100) : null
    const age    = s.age != null
      ? s.age as number
      : s.date_of_birth
        ? Math.floor((Date.now() - new Date(s.date_of_birth as string).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null
    return {
      student_id:         s.id,
      student_name:       [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—',
      student_code:       s.student_code ?? null,
      age,
      branch_id:          s.branch_id as string,
      branch_name:        (s.branches as any)?.name ?? '',
      phone:              s.users?.phone ?? null,
      parent_phone:       guardianPhoneMap.get(s.id) ?? null,
      group_name:         groupMap.get(s.id) ?? null,
      attendance_pct:     attPct,
      sessions_remaining: sessMap.get(s.id) ?? null,
    }
  })
}
