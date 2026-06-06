import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstructorFilterOptions } from '@/modules/query-standards'

// ── Types ──────────────────────────────────────────────────────────────────────

export type StudentOpStatus =
  | 'ACTIVE'
  | 'NO_GROUP'
  | 'INACTIVE'
  | 'LOW_ATTENDANCE'
  | 'NEAR_EXHAUSTION'
  | 'MULTI_CONTRACT'
  | 'NEW_STUDENT'

export interface StudentGuardian {
  id: string
  name: string
  relation: string
  phone1: string | null
  phone2: string | null
  whatsapp_preferred: boolean
  is_primary: boolean
  is_emergency: boolean
}

export interface StudentGroupMembership {
  group_id:   string
  group_name: string
}

export interface GroupPickerOption {
  group_id:        string
  group_name:      string
  branch_id:       string
  branch_name:     string
  status:          string
  course_id:       string | null
  course_name:     string | null
  instructor_id:   string | null
  instructor_name: string | null
  day_of_week:     string | null
  start_time:      string | null
  student_count:   number
  capacity:        number | null
}

export interface StudentOperationalRow {
  student_id:       string
  user_id:          string
  // Split names — required for accurate edit form pre-fill
  first_name:       string | null
  last_name:        string | null
  student_name:     string
  student_code:     string | null
  student_phone:    string | null
  age:              number | null
  date_of_birth:    string | null
  branch_id:        string
  branch_name:      string
  student_status:   string
  school_grade:     string | null
  enrollment_date:  string
  notes:            string | null

  // Academic
  group_id:          string | null
  group_name:        string | null
  course_id:         string | null
  course_name:       string | null
  instructor_id:     string | null
  instructor_name:   string | null
  group_memberships: StudentGroupMembership[]

  // Sessions (from active enrollment)
  enrolled_sessions:  number
  consumed_sessions:  number
  remaining_sessions: number

  // Attendance (from attendance_records)
  total_sessions:      number
  sessions_attended:   number
  attendance_pct:      number
  consecutive_absences: number
  last_attendance_date: string | null

  // Risk (attendance-only, no finance)
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_flags: string[]

  // Operational status
  op_status: StudentOpStatus

  // Guardians
  guardians:            StudentGuardian[]
  primary_guardian_name:  string | null
  primary_guardian_phone: string | null
  guardian_count:       number

  // Multi-contract
  active_enrollment_count: number

  // Auth account
  user_email: string | null
}

// ── Query ──────────────────────────────────────────────────────────────────────

export async function listStudentsOperational(
  branchIds: string[]
): Promise<StudentOperationalRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // 1. Load students (includes age, notes)
  const { data: students, error: stuErr } = await db
    .from('students')
    .select(`
      id, user_id, branch_id, student_code, enrollment_date, status,
      school_grade, emergency_contact, age, notes,
      users!students_user_id_fkey!left(
        email, phone,
        profiles!profiles_user_id_fkey!left(first_name, last_name, date_of_birth)
      ),
      branches!students_branch_id_fkey!left(name)
    `)
    .in('branch_id', branchIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (stuErr) throw new Error(stuErr.message)
  const stuRows = (students ?? []) as any[]
  if (!stuRows.length) return []

  const studentIds = stuRows.map((s: any) => s.id as string)

  // 2. Load active group memberships with course ID + instructor ID
  const { data: gsMem } = await db
    .from('group_students')
    .select(`
      student_id,
      groups!group_students_group_id_fkey(
        id, name,
        group_courses!group_courses_group_id_fkey(
          id,
          courses!group_courses_course_id_fkey(id, title),
          instructors!group_courses_instructor_id_fkey(
            id,
            users!instructors_user_id_fkey(
              profiles!profiles_user_id_fkey(first_name, last_name)
            )
          )
        )
      )
    `)
    .in('student_id', studentIds)
    .eq('status', 'active')

  const gsMap = new Map<string, any>()
  const gsMembershipMap = new Map<string, StudentGroupMembership[]>()
  for (const gs of (gsMem ?? []) as any[]) {
    if (!gsMap.has(gs.student_id)) gsMap.set(gs.student_id, gs)
    const grp = gs.groups
    if (grp?.id) {
      const arr = gsMembershipMap.get(gs.student_id) ?? []
      arr.push({ group_id: grp.id as string, group_name: grp.name as string })
      gsMembershipMap.set(gs.student_id, arr)
    }
  }

  // 3. Load active enrollments (sessions only, no finance)
  const { data: enrolls } = await db
    .from('student_enrollments')
    .select('student_id, id, enrolled_sessions, consumed_sessions, remaining_sessions, status')
    .in('student_id', studentIds)
    .eq('status', 'ACTIVE')

  const enrollMap = new Map<string, any[]>()
  for (const e of (enrolls ?? []) as any[]) {
    const arr = enrollMap.get(e.student_id) ?? []
    arr.push(e)
    enrollMap.set(e.student_id, arr)
  }

  // 4. Load attendance aggregates per student
  const { data: attRows } = await db
    .from('attendance_records')
    .select('student_id, status, session_date')
    .in('student_id', studentIds)
    .order('session_date', { ascending: false })

  const attMap = new Map<string, {
    total: number; attended: number; pct: number
    consec_absences: number; last_date: string | null
  }>()

  const grouped = new Map<string, any[]>()
  for (const r of (attRows ?? []) as any[]) {
    const arr = grouped.get(r.student_id) ?? []
    arr.push(r)
    grouped.set(r.student_id, arr)
  }

  for (const [sid, recs] of grouped) {
    const total    = recs.length
    const attended = recs.filter((r: any) => r.status === 'present').length
    const pct      = total > 0 ? Math.round((attended / total) * 100) : 0

    let consec = 0
    for (const r of recs) {
      if (r.status !== 'present') consec++
      else break
    }

    attMap.set(sid, { total, attended, pct, consec_absences: consec, last_date: recs[0]?.session_date ?? null })
  }

  // 5. Load guardians
  const { data: guardianRows } = await db
    .from('student_guardians')
    .select('id, student_id, name, relation, phone1, phone2, whatsapp_preferred, is_primary, is_emergency')
    .in('student_id', studentIds)
    .order('is_primary', { ascending: false })

  const guardianMap = new Map<string, StudentGuardian[]>()
  for (const g of (guardianRows ?? []) as any[]) {
    const arr = guardianMap.get(g.student_id) ?? []
    arr.push({
      id: g.id, name: g.name, relation: g.relation,
      phone1: g.phone1, phone2: g.phone2,
      whatsapp_preferred: g.whatsapp_preferred,
      is_primary: g.is_primary, is_emergency: g.is_emergency,
    })
    guardianMap.set(g.student_id, arr)
  }

  // 6. Assemble rows
  return stuRows.map((s: any) => {
    const prof       = s.users?.profiles ?? {}
    const firstName  = prof.first_name ?? null
    const lastName   = prof.last_name  ?? null
    const name       = [firstName, lastName].filter(Boolean).join(' ') || s.users?.email || '—'
    const ec         = (s.emergency_contact ?? {}) as Record<string, string>

    const gs        = gsMap.get(s.id)
    const groupObj  = gs?.groups ?? null
    const gcFirst   = (groupObj?.group_courses ?? [])[0] ?? null
    const courseObj = gcFirst?.courses ?? null
    const instrObj  = gcFirst?.instructors ?? null
    const instrProf = instrObj?.users?.profiles ?? null
    const instrName = instrProf
      ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ')
      : null

    const activeEnrolls = enrollMap.get(s.id) ?? []
    const mainEnroll    = activeEnrolls[0] ?? null

    const att = attMap.get(s.id) ?? {
      total: 0, attended: 0, pct: 0, consec_absences: 0, last_date: null,
    }

    // Guardians — prefer student_guardians table, fallback to emergency_contact JSONB
    let guardians = guardianMap.get(s.id) ?? []
    if (!guardians.length && (ec.phone1 || ec.phone2)) {
      guardians = [{
        id: '', name: ec.name ?? 'Guardian', relation: 'guardian',
        phone1: ec.phone1 ?? null, phone2: ec.phone2 ?? null,
        whatsapp_preferred: false, is_primary: true, is_emergency: true,
      }]
    }

    const primaryGuardian = guardians.find(g => g.is_primary) ?? guardians[0] ?? null

    // Risk flags (attendance-only — zero finance)
    const risk_flags: string[] = []
    if (!groupObj)                                                      risk_flags.push('no_group')
    if (att.consec_absences >= 3)                                       risk_flags.push('consecutive_absences')
    if (att.total >= 4 && att.pct < 50)                                 risk_flags.push('low_attendance_critical')
    else if (att.total >= 3 && att.pct < 70)                            risk_flags.push('low_attendance')
    if (mainEnroll && mainEnroll.remaining_sessions <= 2 && mainEnroll.enrolled_sessions > 0)
                                                                        risk_flags.push('near_exhaustion')
    if (!guardians.length)                                              risk_flags.push('no_guardian')

    let risk_level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
    if (att.consec_absences >= 3 || (att.total >= 4 && att.pct < 50) || s.status !== 'active') {
      risk_level = 'HIGH'
    } else if (
      att.consec_absences >= 2 || (att.total >= 3 && att.pct < 70) ||
      (mainEnroll && mainEnroll.remaining_sessions <= 2 && mainEnroll.enrolled_sessions > 0)
    ) {
      risk_level = 'MEDIUM'
    }

    // Operational status
    let op_status: StudentOpStatus = 'ACTIVE'
    if (s.status !== 'active') {
      op_status = 'INACTIVE'
    } else if (!groupObj) {
      const daysSince = (Date.now() - new Date(s.enrollment_date).getTime()) / 86400000
      op_status = daysSince < 21 ? 'NEW_STUDENT' : 'NO_GROUP'
    } else if (att.total < 2) {
      const daysSince = (Date.now() - new Date(s.enrollment_date).getTime()) / 86400000
      op_status = daysSince < 21 ? 'NEW_STUDENT' : 'ACTIVE'
    } else if (att.total >= 3 && att.pct < 60) {
      op_status = 'LOW_ATTENDANCE'
    } else if (mainEnroll && mainEnroll.remaining_sessions <= 2 && mainEnroll.enrolled_sessions > 0) {
      op_status = 'NEAR_EXHAUSTION'
    } else if (activeEnrolls.length > 1) {
      op_status = 'MULTI_CONTRACT'
    }

    return {
      student_id:       s.id,
      user_id:          s.user_id,
      user_email:       s.users?.email ?? null,
      first_name:       firstName,
      last_name:        lastName,
      student_name:     name,
      student_code:     s.student_code,
      student_phone:    s.users?.phone ?? null,
      age:              s.age ?? null,
      date_of_birth:    prof.date_of_birth ?? null,
      branch_id:        s.branch_id,
      branch_name:      s.branches?.name ?? '',
      student_status:   s.status,
      school_grade:     s.school_grade,
      enrollment_date:  s.enrollment_date,
      notes:            s.notes ?? null,

      group_id:          groupObj?.id ?? null,
      group_name:        groupObj?.name ?? null,
      course_id:         courseObj?.id ?? null,
      course_name:       courseObj?.title ?? null,
      instructor_id:     instrObj?.id ?? null,
      instructor_name:   instrName,
      group_memberships: gsMembershipMap.get(s.id) ?? [],

      enrolled_sessions:  mainEnroll?.enrolled_sessions  ?? 0,
      consumed_sessions:  mainEnroll?.consumed_sessions  ?? 0,
      remaining_sessions: mainEnroll?.remaining_sessions ?? 0,

      total_sessions:      att.total,
      sessions_attended:   att.attended,
      attendance_pct:      att.pct,
      consecutive_absences: att.consec_absences,
      last_attendance_date: att.last_date,

      risk_level,
      risk_flags,
      op_status,

      guardians,
      primary_guardian_name:  primaryGuardian?.name  ?? null,
      primary_guardian_phone: primaryGuardian?.phone1 ?? null,
      guardian_count:         guardians.length,

      active_enrollment_count: activeEnrolls.length,
    } satisfies StudentOperationalRow
  })
}

// ── Guardian helpers ──────────────────────────────────────────────────────────

export async function getStudentGuardians(studentId: string): Promise<StudentGuardian[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('student_guardians')
    .select('id, name, relation, phone1, phone2, whatsapp_preferred, is_primary, is_emergency')
    .eq('student_id', studentId)
    .order('is_primary', { ascending: false })
  return (data ?? []) as StudentGuardian[]
}

// ── Filter options ────────────────────────────────────────────────────────────

export async function getOperationalFilterOptions(branchIds: string[]) {
  if (!branchIds.length) return { branches: [], groups: [], courses: [], instructors: [] }
  const db = createServiceClient()

  const [branchRes, groupRes, courseRes, instructors] = await Promise.all([
    db.from('branches').select('id, name').in('id', branchIds).order('name'),
    db.from('groups').select('id, name').in('branch_id', branchIds).is('deleted_at', null).order('name'),
    db.from('courses').select('id, title').order('title'),
    getInstructorFilterOptions(branchIds),
  ])

  return {
    branches:    (branchRes.data ?? []) as { id: string; name: string }[],
    groups:      (groupRes.data ?? []) as { id: string; name: string }[],
    courses:     (courseRes.data ?? []) as { id: string; title: string }[],
    instructors,
  }
}

// ── Group picker (for student form modal) ─────────────────────────────────────

export async function getGroupPickerOptions(branchIds: string[]): Promise<GroupPickerOption[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data: groups } = await db
    .from('groups')
    .select(`id, name, branch_id, status, day_of_week, time, capacity,
             branches!groups_branch_id_fkey(name)`)
    .in('branch_id', branchIds)
    .in('status', ['forming', 'active'])
    .is('deleted_at', null)
    .order('name')

  const groupRows = (groups ?? []) as any[]
  if (!groupRows.length) return []
  const groupIds = groupRows.map((g: any) => g.id as string)

  const [gcRes, gsCountRes, giRes] = await Promise.all([
    db.from('group_courses')
      .select(`group_id, course_id, instructor_id, courses!group_courses_course_id_fkey(title)`)
      .in('group_id', groupIds)
      .eq('status', 'active'),
    db.from('group_students')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('status', 'active'),
    db.from('group_instructors')
      .select(`group_id, instructor_id,
               instructors!group_instructors_instructor_id_fkey(
                 users!instructors_user_id_fkey(
                   profiles!profiles_user_id_fkey(first_name, last_name)
                 )
               )`)
      .in('group_id', groupIds)
      .eq('role', 'lead'),
  ])

  const courseMap = new Map<string, { course_id: string; course_name: string; instructor_id: string | null }>()
  for (const gc of (gcRes.data ?? []) as any[]) {
    courseMap.set(gc.group_id, {
      course_id:     gc.course_id,
      course_name:   gc.courses?.title ?? '',
      instructor_id: gc.instructor_id ?? null,
    })
  }

  const studentCountMap = new Map<string, number>()
  for (const gs of (gsCountRes.data ?? []) as any[]) {
    studentCountMap.set(gs.group_id, (studentCountMap.get(gs.group_id) ?? 0) + 1)
  }

  const instrNameMap = new Map<string, string>()
  for (const gi of (giRes.data ?? []) as any[]) {
    const prof = gi.instructors?.users?.profiles ?? {}
    const name = [prof.first_name, prof.last_name].filter(Boolean).join(' ')
    if (name) instrNameMap.set(gi.group_id as string, name)
  }

  return groupRows.map((g: any): GroupPickerOption => {
    const course = courseMap.get(g.id)
    return {
      group_id:        g.id,
      group_name:      g.name,
      branch_id:       g.branch_id,
      branch_name:     (g.branches as any)?.name ?? '',
      status:          g.status,
      course_id:       course?.course_id        ?? null,
      course_name:     course?.course_name       ?? null,
      instructor_id:   course?.instructor_id     ?? null,
      instructor_name: instrNameMap.get(g.id)   ?? null,
      day_of_week:     g.day_of_week             ?? null,
      start_time:      g.time                    ?? null,
      student_count:   studentCountMap.get(g.id) ?? 0,
      capacity:        g.capacity                ?? null,
    }
  })
}
