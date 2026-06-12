import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function nameFromProfile(p: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
  if (!p) return 'Unknown'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionStartingSoon {
  schedule_id:      string
  group_id:         string
  group_name:       string
  course_title:     string | null
  instructor_name:  string | null
  instructor_phone: string | null
  branch_name:      string | null
  student_count:    number
  starts_in_min:    number     // minutes until start
  scheduled_at:     string
  branch_id:        string
}

export interface OverdueCollectionItem {
  enrollment_id:   string
  student_id:      string
  student_name:    string
  student_code:    string | null
  parent_phone:    string | null
  student_phone:   string | null
  group_name:      string | null
  remaining_amount: number
  days_overdue:    number
  next_due_date:   string | null
}

export interface RenewalItem {
  enrollment_id:      string
  student_id:         string
  student_name:       string
  student_code:       string | null
  parent_phone:       string | null
  student_phone:      string | null
  group_name:         string | null
  remaining_sessions: number
  enrolled_sessions:  number | null
  urgency:            'exhausted' | 'critical' | 'warning'
}

export interface MissingDataAlert {
  type:        'no_instructor' | 'no_course' | 'no_group' | 'missing_attendance' | 'orphan_enrollment'
  entity_id:   string
  entity_name: string
  branch_id:   string
  severity:    'critical' | 'warning' | 'info'
  href:        string
}

export interface GroupHealthRow {
  group_id:                  string
  branch_id:                 string
  group_name:                string
  status:                    string
  capacity:                  number | null
  active_students:           number
  capacity_pct:              number | null
  instructor_name:           string | null
  instructor_id:             string | null
  course_name:               string | null
  course_id:                 string | null
  avg_attendance_pct:        number | null
  avg_assignment_pct:        number | null
  unpaid_students:           number
  critical_sessions_count:   number
  sessions_missing_attendance: number
  last_session_date:         string | null
  next_session_at:           string | null
  health_status:             'healthy' | 'warning' | 'danger'
  health_score:              number   // 0-100
  day_of_week:               string | null
  group_time:                string | null
}

export interface StudentRiskRow {
  student_id:            string
  branch_id:             string
  student_name:          string
  student_code:          string | null
  student_phone:         string | null
  parent_phone:          string | null
  current_group_id:      string | null
  current_group_name:    string | null
  attendance_score:      number
  assignment_score:      number
  remaining_sessions:    number | null
  finance_status:        string | null
  remaining_balance:     number
  days_since_attendance: number | null
  risk_score:            number
  risk_flags:            string[]
}

export interface ParentEscalationItem {
  id:          string
  branch_id:   string
  student_id:  string | null
  student_name: string | null
  parent_name: string | null
  parent_phone: string | null
  subject:     string | null
  status:      string
  priority:    'high' | 'medium' | 'low'
  created_at:  string
  age_hours:   number
}

export interface AcademicQualityData {
  homework_rate:          number
  attendance_rate:        number
  submission_rate:        number
  low_engagement_groups:  number
  pending_reviews:        number
  groups_no_session_7d:   number
}

export interface RecentActivityItem {
  id:          string
  action:      string
  entity_type: string
  entity_id:   string | null
  actor_name:  string | null
  notes:       string | null
  branch_id:   string | null
  created_at:  string
  href:        string | null
}

export interface FinanceDailyData {
  collected_today:       number
  collected_this_month:  number
  outstanding:           number
  collection_rate:       number
  overdue_count:         number
  due_today:             number
  due_this_week:         number
  overdue_total_amount:  number
  exhausted_count:       number
  low_sessions_count:    number
}

// ─── Sessions starting in the next 2 hours ───────────────────────────────────

export async function getSessionsStartingSoon(branchIds: string[]): Promise<SessionStartingSoon[]> {
  if (!branchIds.length) return []

  const db  = createServiceClient()
  const now = new Date()
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const { data: schedRows } = await db
    .from('schedules')
    .select(`
      id, scheduled_at, branch_id,
      group_courses!schedules_group_course_id_fkey(
        group_id,
        courses!group_courses_course_id_fkey(title),
        groups!group_courses_group_id_fkey(name, branch_id),
        instructors!group_courses_instructor_id_fkey(
          users!instructors_user_id_fkey(phone, profiles!profiles_user_id_fkey(first_name, last_name))
        )
      )
    `)
    .in('branch_id', branchIds)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in2h.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })

  if (!schedRows?.length) return []

  const groupIds = [...new Set(
    (schedRows as any[]).map(r => r.group_courses?.group_id as string).filter(Boolean)
  )]

  const studentCounts = new Map<string, number>()
  if (groupIds.length) {
    const { data: gs } = await db
      .from('group_students')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('status', 'active')
    for (const g of gs ?? []) {
      const gid = (g as any).group_id as string
      studentCounts.set(gid, (studentCounts.get(gid) ?? 0) + 1)
    }
  }

  return (schedRows as any[]).map(r => {
    const gc        = r.group_courses
    const instrUser = gc?.instructors?.users
    const instrProf = instrUser?.profiles
    const startsAt  = new Date(r.scheduled_at)
    return {
      schedule_id:      r.id,
      group_id:         gc?.group_id ?? '',
      group_name:       gc?.groups?.name ?? '—',
      course_title:     gc?.courses?.title ?? null,
      instructor_name:  instrProf ? nameFromProfile(instrProf) : null,
      instructor_phone: instrUser?.phone ?? null,
      branch_name:      null,
      student_count:    studentCounts.get(gc?.group_id) ?? 0,
      starts_in_min:    Math.max(0, Math.floor((startsAt.getTime() - now.getTime()) / 60000)),
      scheduled_at:     r.scheduled_at,
      branch_id:        r.branch_id,
    } satisfies SessionStartingSoon
  })
}

// ─── Overdue collections ──────────────────────────────────────────────────────

export async function getOverdueCollections(branchIds: string[], limit = 25): Promise<OverdueCollectionItem[]> {
  if (!branchIds.length) return []

  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: accRows } = await db
    .from('student_financial_accounts')
    .select(`
      enrollment_id, student_id, remaining_amount, next_due_date,
      student_enrollments!student_financial_accounts_enrollment_id_fkey(
        group_id,
        groups!student_enrollments_group_id_fkey(name)
      )
    `)
    .in('branch_id', branchIds)
    .lte('next_due_date', today)
    .gt('remaining_amount', 0)
    .in('status', ['OVERDUE', 'DUE_SOON', 'CURRENT'])
    .order('next_due_date', { ascending: true })
    .limit(limit * 2)

  if (!accRows?.length) return []

  const studentIds = [...new Set((accRows as any[]).map(r => r.student_id as string))]

  const [studRes, parentRes] = await Promise.all([
    db.from('students')
      .select('id, student_code, users!students_user_id_fkey(phone, profiles!profiles_user_id_fkey(first_name, last_name))')
      .in('id', studentIds),
    db.from('student_parent_contacts')
      .select('student_id, phone1')
      .in('student_id', studentIds)
      .not('phone1', 'is', null),
  ])

  const studMap   = new Map<string, any>()
  const parentMap = new Map<string, string>()
  for (const s of (studRes.data ?? []) as any[])   studMap.set(s.id, s)
  for (const p of (parentRes.data ?? []) as any[]) {
    if (!parentMap.has(p.student_id)) parentMap.set(p.student_id as string, p.phone1 as string)
  }

  const results: OverdueCollectionItem[] = []
  const seenEnroll = new Set<string>()

  for (const a of (accRows as any[]) as any[]) {
    if (!a.enrollment_id || seenEnroll.has(a.enrollment_id)) continue
    seenEnroll.add(a.enrollment_id)

    const dueDate  = a.next_due_date as string
    const daysOvr  = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
    if (daysOvr < 0) continue  // not yet overdue

    const stud  = studMap.get(a.student_id)
    const prof  = stud?.users?.profiles
    results.push({
      enrollment_id:    a.enrollment_id as string,
      student_id:       a.student_id as string,
      student_name:     prof ? nameFromProfile(prof) : 'Unknown',
      student_code:     stud?.student_code ?? null,
      parent_phone:     parentMap.get(a.student_id) ?? null,
      student_phone:    stud?.users?.phone ?? null,
      group_name:       (a.student_enrollments as any)?.groups?.name ?? null,
      remaining_amount: Number(a.remaining_amount ?? 0),
      days_overdue:     daysOvr,
      next_due_date:    dueDate,
    })
  }

  return results
    .sort((a, b) => b.days_overdue - a.days_overdue || b.remaining_amount - a.remaining_amount)
    .slice(0, limit)
}

// ─── Renewals needed ─────────────────────────────────────────────────────────

export async function getRenewalsNeeded(branchIds: string[], limit = 25): Promise<RenewalItem[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  const { data: enrollRows } = await db
    .from('student_enrollments')
    .select(`
      id, student_id, remaining_sessions, enrolled_sessions,
      students!student_enrollments_student_id_fkey(
        student_code,
        users!students_user_id_fkey(phone, profiles!profiles_user_id_fkey(first_name, last_name))
      ),
      groups!student_enrollments_group_id_fkey(name)
    `)
    .in('branch_id', branchIds)
    .eq('status', 'ACTIVE')
    .lte('remaining_sessions', 2)
    .order('remaining_sessions', { ascending: true })
    .limit(limit * 2)

  if (!enrollRows?.length) return []

  const studentIds = [...new Set((enrollRows as any[]).map(r => r.student_id as string))]
  const { data: parentRows } = await db
    .from('student_parent_contacts')
    .select('student_id, phone1')
    .in('student_id', studentIds)
    .not('phone1', 'is', null)

  const parentMap = new Map<string, string>()
  for (const p of (parentRows ?? []) as any[]) {
    if (!parentMap.has(p.student_id)) parentMap.set(p.student_id as string, p.phone1 as string)
  }

  return ((enrollRows as any[]) as any[]).slice(0, limit).map(e => {
    const s      = e.students ?? {}
    const prof   = s.users?.profiles
    const sessLeft = Number(e.remaining_sessions ?? 0)
    return {
      enrollment_id:      e.id as string,
      student_id:         e.student_id as string,
      student_name:       prof ? nameFromProfile(prof) : 'Unknown',
      student_code:       s.student_code ?? null,
      parent_phone:       parentMap.get(e.student_id) ?? null,
      student_phone:      s.users?.phone ?? null,
      group_name:         e.groups?.name ?? null,
      remaining_sessions: sessLeft,
      enrolled_sessions:  e.enrolled_sessions != null ? Number(e.enrolled_sessions) : null,
      urgency:            sessLeft <= 0 ? 'exhausted' : sessLeft <= 1 ? 'critical' : 'warning',
    } satisfies RenewalItem
  })
}

// ─── Missing operational data ─────────────────────────────────────────────────

export async function getMissingOperationalData(branchIds: string[]): Promise<MissingDataAlert[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  // Try v_operations_alerts first (fast path)
  const { data: alertRows, error: viewErr } = await db
    .from('v_operations_alerts')
    .select('*')
    .in('branch_id', branchIds)
    .limit(50)

  if (!viewErr && alertRows?.length) {
    return (alertRows as any[]).map(r => ({
      type:        r.alert_type as MissingDataAlert['type'],
      entity_id:   r.entity_id as string,
      entity_name: r.entity_name as string,
      branch_id:   r.branch_id as string,
      severity:    r.severity as MissingDataAlert['severity'],
      href:        r.alert_type === 'no_instructor' || r.alert_type === 'no_course' || r.alert_type === 'missing_attendance'
                     ? `/portal/team-leader/groups/${r.entity_id}`
                     : `/portal/team-leader/students/${r.entity_id}`,
    }))
  }

  // Fallback: inline queries
  const alerts: MissingDataAlert[] = []

  const [groupsRes, missingGroupStudRes, completedSessionsRes] = await Promise.all([
    // Active groups
    db.from('groups')
      .select('id, name, branch_id')
      .in('branch_id', branchIds)
      .in('status', ['active', 'forming'])
      .is('deleted_at', null)
      .limit(200),

    // Students with active enrollment but no group
    db.from('student_enrollments')
      .select(`
        student_id,
        students!student_enrollments_student_id_fkey(
          users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
        )
      `)
      .in('branch_id', branchIds)
      .eq('status', 'ACTIVE')
      .is('group_id', null)
      .limit(20),

    // Completed sessions in last 14 days with no attendance
    db.from('schedules')
      .select(`
        id, scheduled_at, branch_id,
        group_courses!schedules_group_course_id_fkey(
          groups!group_courses_group_id_fkey(id, name)
        )
      `)
      .in('branch_id', branchIds)
      .eq('status', 'completed')
      .gte('scheduled_at', new Date(Date.now() - 14 * 86400000).toISOString())
      .limit(30),
  ])

  // Groups without instructor or course
  const activeGroups = (groupsRes.data ?? []) as any[]
  if (activeGroups.length > 0) {
    const groupIds = activeGroups.map(g => g.id as string)
    const { data: gcRows } = await db
      .from('group_courses')
      .select('group_id, course_id, instructor_id')
      .in('group_id', groupIds)
      .eq('status', 'active')

    const gcByGroup = new Map<string, { hasInstructor: boolean; hasCourse: boolean }>()
    for (const gc of (gcRows ?? []) as any[]) {
      const gid = gc.group_id as string
      const existing = gcByGroup.get(gid) ?? { hasInstructor: false, hasCourse: false }
      if (gc.instructor_id) existing.hasInstructor = true
      if (gc.course_id)     existing.hasCourse     = true
      gcByGroup.set(gid, existing)
    }

    for (const g of activeGroups) {
      const gc = gcByGroup.get(g.id) ?? { hasInstructor: false, hasCourse: false }
      if (!gc.hasInstructor) {
        alerts.push({ type: 'no_instructor', entity_id: g.id, entity_name: g.name, branch_id: g.branch_id, severity: 'warning', href: `/portal/team-leader/groups/${g.id}` })
      }
      if (!gc.hasCourse) {
        alerts.push({ type: 'no_course', entity_id: g.id, entity_name: g.name, branch_id: g.branch_id, severity: 'warning', href: `/portal/team-leader/groups/${g.id}` })
      }
    }
  }

  // Students missing groups
  for (const e of (missingGroupStudRes.data ?? []) as any[]) {
    const prof = e.students?.users?.profiles
    alerts.push({
      type: 'no_group', entity_id: e.student_id, entity_name: prof ? nameFromProfile(prof) : 'Student',
      branch_id: branchIds[0], severity: 'info', href: `/portal/team-leader/students/${e.student_id}`,
    })
  }

  // Sessions missing attendance
  const seenSched = new Set<string>()
  for (const s of (completedSessionsRes.data ?? []) as any[]) {
    if (seenSched.has(s.id)) continue
    seenSched.add(s.id)
    const groupName = s.group_courses?.groups?.name ?? 'Group'
    const dateStr   = new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    alerts.push({
      type: 'missing_attendance', entity_id: s.id, entity_name: `${groupName} — ${dateStr}`,
      branch_id: s.branch_id, severity: 'critical',
      href: `/portal/team-leader/attendance/record?schedule=${s.id}`,
    })
  }

  // Filter out duplicates — check which sessions already have attendance
  const schedIds = alerts.filter(a => a.type === 'missing_attendance').map(a => a.entity_id)
  if (schedIds.length) {
    const { data: attRows } = await db
      .from('attendance_records')
      .select('schedule_id')
      .in('schedule_id', schedIds)
    const attSet = new Set((attRows ?? []).map((r: any) => r.schedule_id as string))
    return alerts.filter(a => a.type !== 'missing_attendance' || !attSet.has(a.entity_id))
  }

  return alerts
}

// ─── Group health board ───────────────────────────────────────────────────────

export async function getGroupHealthData(branchIds: string[]): Promise<GroupHealthRow[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  // Try the view first
  const { data: viewRows, error: viewErr } = await db
    .from('v_group_health')
    .select('*')
    .in('branch_id', branchIds)

  if (!viewErr && viewRows?.length) {
    return (viewRows as any[]).map(r => buildGroupHealthRow(r))
  }

  // Fallback: direct query
  const { data: groupRows } = await db
    .from('groups')
    .select(`
      id, branch_id, name, status, capacity, day_of_week, time,
      start_date
    `)
    .in('branch_id', branchIds)
    .in('status', ['active', 'forming'])
    .is('deleted_at', null)
    .order('name')
    .limit(200)

  if (!groupRows?.length) return []

  const groupIds = (groupRows as any[]).map(g => g.id as string)

  const [gsRes, gcRes, progressRes, financeRes, enrollRes] = await Promise.all([
    db.from('group_students').select('group_id, student_id').in('group_id', groupIds).eq('status', 'active'),
    db.from('group_courses').select(`
      group_id, course_id, instructor_id,
      courses!group_courses_course_id_fkey(title),
      instructors!group_courses_instructor_id_fkey(
        id,
        users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `).in('group_id', groupIds).eq('status', 'active'),
    db.from('student_course_progress').select('group_id, student_id, attendance_score, assignment_score').in('group_id', groupIds).eq('status', 'active'),
    db.from('student_financial_accounts').select('student_id, status').in('status', ['OVERDUE']),
    db.from('student_enrollments').select('student_id, remaining_sessions, status').in('status', ['ACTIVE']).lte('remaining_sessions', 2),
  ])

  const gsByGroup   = new Map<string, string[]>()
  const gcByGroup   = new Map<string, any>()
  const progByGroup = new Map<string, { att: number[]; asn: number[] }>()
  const overdueSet  = new Set<string>()
  const lowSessSet  = new Set<string>()

  for (const gs of (gsRes.data ?? []) as any[]) {
    const arr = gsByGroup.get(gs.group_id) ?? []
    arr.push(gs.student_id)
    gsByGroup.set(gs.group_id, arr)
  }
  for (const gc of (gcRes.data ?? []) as any[]) {
    if (!gcByGroup.has(gc.group_id)) gcByGroup.set(gc.group_id, gc)
  }
  for (const p of (progressRes.data ?? []) as any[]) {
    const entry = progByGroup.get(p.group_id) ?? { att: [], asn: [] }
    entry.att.push(p.attendance_score ?? 0)
    entry.asn.push(p.assignment_score ?? 0)
    progByGroup.set(p.group_id, entry)
  }
  for (const f of (financeRes.data ?? []) as any[]) overdueSet.add(f.student_id as string)
  for (const e of (enrollRes.data ?? []) as any[]) lowSessSet.add(e.student_id as string)

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null

  return (groupRows as any[]).map(g => {
    const students  = gsByGroup.get(g.id) ?? []
    const gc        = gcByGroup.get(g.id)
    const prog      = progByGroup.get(g.id) ?? { att: [], asn: [] }
    const instrProf = gc?.instructors?.users?.profiles
    const attAvg    = avg(prog.att)
    const asnAvg    = avg(prog.asn)
    const unpaid    = students.filter(sid => overdueSet.has(sid)).length
    const lowSess   = students.filter(sid => lowSessSet.has(sid)).length

    return buildGroupHealthRow({
      group_id:                  g.id,
      branch_id:                 g.branch_id,
      group_name:                g.name,
      group_status:              g.status,
      capacity:                  g.capacity,
      active_students:           students.length,
      capacity_pct:              g.capacity ? Math.round(100 * students.length / g.capacity) : null,
      instructor_name:           instrProf ? nameFromProfile(instrProf) : null,
      instructor_id:             gc?.instructor_id ?? null,
      course_name:               gc?.courses?.title ?? null,
      course_id:                 gc?.course_id ?? null,
      avg_attendance_pct:        attAvg,
      avg_assignment_pct:        asnAvg,
      unpaid_students:           unpaid,
      critical_sessions_count:   lowSess,
      sessions_missing_attendance: 0,
      last_session_date:         null,
      next_session_at:           null,
      day_of_week:               g.day_of_week,
      group_time:                g.time,
    })
  })
}

function buildGroupHealthRow(r: any): GroupHealthRow {
  const att    = Number(r.avg_attendance_pct  ?? 0)
  const asn    = Number(r.avg_assignment_pct  ?? 0)
  const unpaid = Number(r.unpaid_students     ?? 0)
  const lowS   = Number(r.critical_sessions_count ?? 0)
  const missAtt = Number(r.sessions_missing_attendance ?? 0)
  const active  = Number(r.active_students ?? 0)

  // Health score: weighted composite
  const healthScore = Math.max(0, Math.min(100,
    (att > 0 ? att : 50) * 0.40 +
    (asn > 0 ? asn : 50) * 0.25 +
    (active > 0 ? 100 : 30) * 0.15 +
    (unpaid === 0 ? 100 : Math.max(0, 100 - unpaid * 20)) * 0.10 +
    (missAtt === 0 ? 100 : Math.max(0, 100 - missAtt * 15)) * 0.10
  ))

  const health_status: 'healthy' | 'warning' | 'danger' =
    healthScore >= 75 && missAtt === 0 ? 'healthy' :
    healthScore >= 50 || missAtt <= 2  ? 'warning' : 'danger'

  return {
    group_id:                  r.group_id,
    branch_id:                 r.branch_id,
    group_name:                r.group_name,
    status:                    r.group_status ?? r.status,
    capacity:                  r.capacity != null ? Number(r.capacity) : null,
    active_students:           active,
    capacity_pct:              r.capacity_pct != null ? Number(r.capacity_pct) : null,
    instructor_name:           r.instructor_name ?? null,
    instructor_id:             r.instructor_id ?? null,
    course_name:               r.course_name ?? null,
    course_id:                 r.course_id ?? null,
    avg_attendance_pct:        att > 0 ? att : null,
    avg_assignment_pct:        asn > 0 ? asn : null,
    unpaid_students:           unpaid,
    critical_sessions_count:   lowS,
    sessions_missing_attendance: missAtt,
    last_session_date:         r.last_session_date ?? null,
    next_session_at:           r.next_session_at   ?? null,
    health_status,
    health_score:              Math.round(healthScore),
    day_of_week:               r.day_of_week ?? null,
    group_time:                r.group_time  ?? null,
  }
}

// ─── Student risk engine ──────────────────────────────────────────────────────

export async function getStudentRiskData(branchIds: string[], limit = 30): Promise<StudentRiskRow[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  // Try the view
  const { data: viewRows, error: viewErr } = await db
    .from('v_student_risk')
    .select('*')
    .in('branch_id', branchIds)
    .gte('risk_score', 20)
    .order('risk_score', { ascending: false })
    .limit(limit)

  if (!viewErr && viewRows?.length) {
    return (viewRows as any[]).map(r => buildRiskRow(r))
  }

  // Fallback from existing getAtRiskStudents pattern
  const { data: progRows } = await db
    .from('student_course_progress')
    .select(`
      student_id, attendance_score, assignment_score, status, group_id,
      groups!student_course_progress_group_id_fkey(name),
      students!student_course_progress_student_id_fkey(
        branch_id, student_code,
        users!students_user_id_fkey(phone, profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .eq('status', 'active')
    .or('attendance_score.lt.75,assignment_score.lt.65')
    .order('attendance_score', { ascending: true })
    .limit(limit * 2)

  const filtered = ((progRows ?? []) as any[]).filter(r =>
    branchIds.includes(r.students?.branch_id)
  )

  if (!filtered.length) return []

  const studentIds = [...new Set(filtered.map((r: any) => r.student_id as string))]

  const [enrollRes, financeRes, parentRes, attRes] = await Promise.all([
    db.from('student_enrollments').select('student_id, remaining_sessions').in('student_id', studentIds).eq('status', 'ACTIVE').order('created_at', { ascending: true }),
    db.from('student_financial_accounts').select('student_id, status, remaining_amount').in('student_id', studentIds),
    db.from('student_parent_contacts').select('student_id, phone1').in('student_id', studentIds).not('phone1', 'is', null),
    db.from('attendance_records').select('student_id, recorded_at').in('student_id', studentIds).in('status', ['present', 'late', 'makeup']).order('recorded_at', { ascending: false }),
  ])

  const sessMap    = new Map<string, number | null>()
  const financeMap = new Map<string, { status: string | null; balance: number }>()
  const parentMap  = new Map<string, string>()
  const lastAttMap = new Map<string, string>()

  for (const e of (enrollRes.data ?? []) as any[]) {
    if (!sessMap.has(e.student_id)) sessMap.set(e.student_id, e.remaining_sessions != null ? Number(e.remaining_sessions) : null)
  }
  for (const f of (financeRes.data ?? []) as any[]) {
    if (!financeMap.has(f.student_id)) financeMap.set(f.student_id, { status: f.status ?? null, balance: Number(f.remaining_amount ?? 0) })
  }
  for (const p of (parentRes.data ?? []) as any[]) {
    if (!parentMap.has(p.student_id)) parentMap.set(p.student_id, p.phone1)
  }
  for (const a of (attRes.data ?? []) as any[]) {
    if (!lastAttMap.has(a.student_id)) lastAttMap.set(a.student_id, a.recorded_at)
  }

  return filtered.slice(0, limit).map(r => {
    const s          = r.students ?? {}
    const prof       = s.users?.profiles
    const sessLeft   = sessMap.get(r.student_id) ?? null
    const fin        = financeMap.get(r.student_id)
    const lastAtt    = lastAttMap.get(r.student_id) ?? null
    const daysSince  = lastAtt ? Math.floor((Date.now() - new Date(lastAtt).getTime()) / 86400000) : null

    const att = Number(r.attendance_score ?? 0)
    const asn = Number(r.assignment_score ?? 0)

    const riskScore = Math.min(100,
      (att < 60 ? 30 : att < 75 ? 15 : 0) +
      (asn < 50 ? 20 : asn < 65 ? 10 : 0) +
      (sessLeft == null || sessLeft <= 0 ? 30 : sessLeft <= 2 ? 15 : 0) +
      (daysSince == null ? 10 : daysSince >= 30 ? 20 : daysSince >= 14 ? 12 : 0) +
      (fin?.status === 'OVERDUE' ? 25 : fin?.status === 'DUE_SOON' ? 10 : 0)
    )

    return buildRiskRow({
      student_id:            r.student_id,
      branch_id:             s.branch_id,
      student_name:          prof ? nameFromProfile(prof) : 'Unknown',
      student_code:          s.student_code ?? null,
      student_phone:         s.users?.phone ?? null,
      parent_phone:          parentMap.get(r.student_id) ?? null,
      current_group_id:      r.group_id ?? null,
      current_group_name:    r.groups?.name ?? null,
      attendance_score:      att,
      assignment_score:      asn,
      remaining_sessions:    sessLeft,
      finance_status:        fin?.status ?? null,
      remaining_balance:     fin?.balance ?? 0,
      days_since_attendance: daysSince,
      risk_score:            riskScore,
    })
  })
}

function buildRiskRow(r: any): StudentRiskRow {
  const flags: string[] = []
  if (Number(r.attendance_score) < 60)        flags.push('Low attendance')
  if (Number(r.assignment_score) < 50)         flags.push('Low homework completion')
  if (r.remaining_sessions != null && Number(r.remaining_sessions) <= 0) flags.push('Sessions exhausted')
  else if (r.remaining_sessions != null && Number(r.remaining_sessions) <= 2) flags.push('1–2 sessions left')
  if (r.days_since_attendance != null && Number(r.days_since_attendance) >= 14) flags.push(`${r.days_since_attendance}d inactive`)
  if (r.finance_status === 'OVERDUE')          flags.push('Overdue payment')
  if (!r.current_group_id)                     flags.push('No group assigned')

  return {
    student_id:            r.student_id,
    branch_id:             r.branch_id,
    student_name:          r.student_name ?? 'Unknown',
    student_code:          r.student_code ?? null,
    student_phone:         r.student_phone ?? null,
    parent_phone:          r.parent_phone ?? null,
    current_group_id:      r.current_group_id ?? null,
    current_group_name:    r.current_group_name ?? null,
    attendance_score:      Number(r.attendance_score ?? 0),
    assignment_score:      Number(r.assignment_score ?? 0),
    remaining_sessions:    r.remaining_sessions != null ? Number(r.remaining_sessions) : null,
    finance_status:        r.finance_status ?? null,
    remaining_balance:     Number(r.remaining_balance ?? 0),
    days_since_attendance: r.days_since_attendance != null ? Number(r.days_since_attendance) : null,
    risk_score:            Number(r.risk_score ?? 0),
    risk_flags:            flags,
  }
}

// ─── Parent escalations ───────────────────────────────────────────────────────

export async function getParentEscalationData(branchIds: string[], limit = 20): Promise<ParentEscalationItem[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  const { data: msgRows } = await db
    .from('parent_messages')
    .select(`
      id, student_id, subject, status, priority, created_at, branch_id,
      students!parent_messages_student_id_fkey(
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .in('branch_id', branchIds)
    .in('status', ['submitted', 'under_review'])
    .order('created_at', { ascending: true })
    .limit(limit)

  if (!msgRows?.length) return []

  const studentIds = [...new Set((msgRows as any[]).map(r => r.student_id as string).filter(Boolean))]
  const parentMap = new Map<string, string>()
  if (studentIds.length) {
    const { data: pRows } = await db
      .from('student_parent_contacts')
      .select('student_id, phone1')
      .in('student_id', studentIds)
      .not('phone1', 'is', null)
    for (const p of (pRows ?? []) as any[]) {
      if (!parentMap.has(p.student_id)) parentMap.set(p.student_id, p.phone1)
    }
  }

  return (msgRows as any[]).map(r => {
    const prof     = r.students?.users?.profiles
    const ageMs    = Date.now() - new Date(r.created_at).getTime()
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60))
    const priority: 'high' | 'medium' | 'low' =
      r.priority === 'high' || ageHours >= 48 ? 'high' :
      r.priority === 'medium' || ageHours >= 24 ? 'medium' : 'low'

    return {
      id:           r.id as string,
      branch_id:    r.branch_id as string,
      student_id:   r.student_id ?? null,
      student_name: prof ? nameFromProfile(prof) : null,
      parent_name:  null,
      parent_phone: r.student_id ? (parentMap.get(r.student_id) ?? null) : null,
      subject:      r.subject ?? null,
      status:       r.status as string,
      priority,
      created_at:   r.created_at as string,
      age_hours:    ageHours,
    } satisfies ParentEscalationItem
  })
}

// ─── Academic quality data ────────────────────────────────────────────────────

export async function getAcademicQualityData(branchIds: string[]): Promise<AcademicQualityData> {
  if (!branchIds.length) {
    return { homework_rate: 0, attendance_rate: 0, submission_rate: 0, low_engagement_groups: 0, pending_reviews: 0, groups_no_session_7d: 0 }
  }

  const db        = createServiceClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const week7ago   = new Date(Date.now() - 7 * 86400000).toISOString()

  const [attRes, progressRes, reviewRes, recentSessionRes] = await Promise.all([
    // Monthly attendance
    db.from('attendance_records')
      .select('status, students!attendance_records_student_id_fkey(branch_id)')
      .gte('recorded_at', monthStart),

    // Group progress averages
    db.from('student_course_progress')
      .select('group_id, attendance_score, assignment_score, students!student_course_progress_student_id_fkey(branch_id)')
      .eq('status', 'active'),

    // Pending portfolio reviews
    db.from('portfolio_projects')
      .select('id, student_id, students!portfolio_projects_student_id_fkey(branch_id)')
      .eq('status', 'pending_review')
      .eq('is_archived', false),

    // Groups with a recent session
    db.from('schedules')
      .select('branch_id, group_courses!schedules_group_course_id_fkey(group_id)')
      .in('branch_id', branchIds)
      .gte('scheduled_at', week7ago)
      .eq('status', 'completed'),
  ])

  // Attendance rate
  const attRows    = ((attRes.data ?? []) as any[]).filter(r => branchIds.includes(r.students?.branch_id))
  const attTotal   = attRows.length
  const attGood    = attRows.filter(r => ['present', 'late', 'makeup'].includes(r.status)).length
  const attendance_rate = attTotal > 0 ? Math.round((attGood / attTotal) * 100) : 0

  // Homework rate from progress scores
  const progRows     = ((progressRes.data ?? []) as any[]).filter(r => branchIds.includes(r.students?.branch_id))
  const avgAssign    = progRows.length > 0
    ? Math.round(progRows.reduce((s: number, r: any) => s + (r.assignment_score ?? 0), 0) / progRows.length)
    : 0
  const avgAtt       = progRows.length > 0
    ? Math.round(progRows.reduce((s: number, r: any) => s + (r.attendance_score ?? 0), 0) / progRows.length)
    : 0

  // Low engagement groups (attendance avg < 60)
  const groupAttMap = new Map<string, number[]>()
  for (const p of progRows) {
    const arr = groupAttMap.get(p.group_id) ?? []
    arr.push(p.attendance_score ?? 0)
    groupAttMap.set(p.group_id, arr)
  }
  let lowEngagement = 0
  for (const [, scores] of groupAttMap) {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length
    if (avg < 60) lowEngagement++
  }

  // Pending reviews (branch filtered)
  const pendingReviews = ((reviewRes.data ?? []) as any[]).filter(r => branchIds.includes(r.students?.branch_id)).length

  // Groups with no session in 7 days
  const activeGroupIds = new Set([...groupAttMap.keys()])
  const recentGroupIds = new Set<string>()
  for (const s of (recentSessionRes.data ?? []) as any[]) {
    if (s.group_courses?.group_id) recentGroupIds.add(s.group_courses.group_id)
  }
  const groups_no_session_7d = [...activeGroupIds].filter(gid => !recentGroupIds.has(gid)).length

  return {
    homework_rate:         avgAssign,
    attendance_rate,
    submission_rate:       avgAssign,
    low_engagement_groups: lowEngagement,
    pending_reviews:       pendingReviews,
    groups_no_session_7d,
  }
}

// ─── Recent activity feed ─────────────────────────────────────────────────────

export async function getRecentActivity(branchIds: string[], limit = 20): Promise<RecentActivityItem[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  const { data, error } = await db
    .from('audit_logs')
    .select(`
      id, action, entity_type, entity_id, branch_id, created_at, new_values,
      profiles!audit_logs_performed_by_fkey(first_name, last_name)
    `)
    .in('branch_id', branchIds)
    .in('entity_type', ['attendance_record', 'finance_payment', 'student_enrollment', 'group_student', 'student'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  return (data as any[]).map(r => {
    const prof     = r.profiles
    const actorName = prof ? nameFromProfile(prof) : null
    const newVals  = r.new_values as Record<string, any> | null

    let description = r.action
    let href: string | null = null

    if (r.entity_type === 'attendance_record') {
      description = `Attendance recorded${newVals?.status ? ` (${newVals.status})` : ''}`
      href = `/portal/team-leader/attendance`
    } else if (r.entity_type === 'finance_payment') {
      const amt = newVals?.amount ? ` EGP ${Number(newVals.amount).toLocaleString()}` : ''
      description = `Payment collected${amt}`
      href = `/portal/team-leader/finance`
    } else if (r.entity_type === 'student_enrollment') {
      description = r.action === 'create' ? 'Enrollment created' : 'Enrollment updated'
    } else if (r.entity_type === 'group_student') {
      description = r.action === 'create' ? 'Student added to group' : 'Student moved'
      if (newVals?.group_id) href = `/portal/team-leader/groups/${newVals.group_id}`
    } else if (r.entity_type === 'student') {
      description = r.action === 'create' ? 'New student registered' : 'Student updated'
      href = r.entity_id ? `/portal/team-leader/students/${r.entity_id}` : null
    }

    return {
      id:          r.id as string,
      action:      description,
      entity_type: r.entity_type as string,
      entity_id:   r.entity_id ?? null,
      actor_name:  actorName,
      notes:       null,
      branch_id:   r.branch_id ?? null,
      created_at:  r.created_at as string,
      href,
    } satisfies RecentActivityItem
  })
}

// ─── Enhanced finance data ────────────────────────────────────────────────────

export async function getFinanceDailyData(branchIds: string[]): Promise<FinanceDailyData> {
  if (!branchIds.length) {
    return { collected_today: 0, collected_this_month: 0, outstanding: 0, collection_rate: 0, overdue_count: 0, due_today: 0, due_this_week: 0, overdue_total_amount: 0, exhausted_count: 0, low_sessions_count: 0 }
  }

  const db         = createServiceClient()
  const today      = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const weekEnd    = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const [paymentsRes, accountsRes, enrollRes] = await Promise.all([
    db.from('finance_payments')
      .select('amount, paid_at')
      .in('branch_id', branchIds)
      .gte('paid_at', monthStart)
      .neq('status', 'cancelled'),

    db.from('student_financial_accounts')
      .select('status, remaining_amount, next_due_date')
      .in('branch_id', branchIds),

    db.from('student_enrollments')
      .select('remaining_sessions')
      .in('branch_id', branchIds)
      .eq('status', 'ACTIVE'),
  ])

  const payments = (paymentsRes.data ?? []) as any[]
  const accounts = (accountsRes.data ?? []) as any[]
  const enrollments = (enrollRes.data ?? []) as any[]

  const collected_today      = payments.filter(p => p.paid_at?.slice(0, 10) === today).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
  const collected_this_month = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)

  const overdue     = accounts.filter(a => a.status === 'OVERDUE')
  const dueSoon     = accounts.filter(a => a.status === 'DUE_SOON' || (a.next_due_date && a.next_due_date <= today))
  const dueThisWeek = accounts.filter(a => a.next_due_date && a.next_due_date > today && a.next_due_date <= weekEnd)

  const outstanding          = accounts.reduce((s: number, a: any) => s + Number(a.remaining_amount ?? 0), 0)
  const overdue_total_amount = overdue.reduce((s: number, a: any) => s + Number(a.remaining_amount ?? 0), 0)
  const total_contracted     = outstanding + collected_this_month
  const collection_rate      = total_contracted > 0 ? Math.round((collected_this_month / total_contracted) * 100) : 0

  const exhausted_count  = enrollments.filter(e => Number(e.remaining_sessions ?? 0) <= 0).length
  const low_sessions_count = enrollments.filter(e => Number(e.remaining_sessions ?? 0) > 0 && Number(e.remaining_sessions ?? 0) <= 3).length

  return {
    collected_today,
    collected_this_month,
    outstanding,
    collection_rate,
    overdue_count:         overdue.length,
    due_today:             dueSoon.length,
    due_this_week:         dueThisWeek.length,
    overdue_total_amount,
    exhausted_count,
    low_sessions_count,
  }
}
