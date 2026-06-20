import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TLKPIs {
  active_students:         number
  monthly_attendance_pct:  number
  homework_completion_pct: number
  parent_satisfaction_avg: number | null
  pending_portfolio_count: number
  cert_ready_count:        number
  open_messages_count:     number
}

export interface TodayClass {
  schedule_id:     string
  group_name:      string
  course_title:    string
  instructor_name: string | null
  scheduled_at:    string
  student_count:   number
}

export interface TodayAttendance {
  present: number
  absent:  number
  late:    number
}

export interface AtRiskStudent {
  student_id:       string
  student_name:     string
  group_name:       string | null
  attendance_score: number
  assignment_score: number
  risk_reasons:     string[]
}

export interface PortfolioQueueItem {
  project_id:    string
  project_title: string
  student_name:  string
  category:      string | null
  created_at:    string
}

export interface CertReadyStudent {
  student_id:    string
  student_name:  string
  group_name:    string | null
  course_title:  string | null
  completion_pct: number
}

export interface InstructorPerf {
  instructor_id:        string
  instructor_name:      string
  active_groups:        number
  active_students:      number
  avg_student_rating:   number | null
  homework_review_pct:  number
  portfolio_review_pct: number
  attendance_rate:      number
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function getTLKPIs(branchIds: string[]): Promise<TLKPIs> {
  if (!branchIds.length) {
    return {
      active_students: 0, monthly_attendance_pct: 0, homework_completion_pct: 0,
      parent_satisfaction_avg: null, pending_portfolio_count: 0,
      cert_ready_count: 0, open_messages_count: 0,
    }
  }

  const db  = createServiceClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: activeStudents },
    attData,
    assignData,
    feedbackData,
    { count: pendingPortfolio },
    certReadyData,
    { count: openMessages },
  ] = await Promise.all([
    // 1. Active students
    db.from('students')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .eq('status', 'active')
      .is('deleted_at', null),

    // 2. Monthly attendance (present+late+makeup / total)
    db.from('attendance_records')
      .select('status, students!attendance_records_student_id_fkey(branch_id)')
      .gte('recorded_at', monthStart),

    // 3. Homework completion (submissions / total published for branch)
    db.from('group_students')
      .select('group_id, students!group_students_student_id_fkey(branch_id)')
      .eq('status', 'active'),

    // 4. Parent satisfaction avg
    db.from('parent_feedback')
      .select('rating, students!parent_feedback_student_id_fkey(branch_id)'),

    // 5. Pending portfolio reviews
    db.from('portfolio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review')
      .eq('is_archived', false)
      .in(
        'student_id',
        (await db.from('students').select('id').in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null)).data?.map((r: any) => r.id) ?? []
      ),

    // 6. Cert ready (high completion, no certificate yet)
    db.from('student_course_progress')
      .select('student_id, completion_percentage')
      .gte('completion_percentage', 90)
      .eq('status', 'active'),

    // 7. Open parent messages
    db.from('parent_messages')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .in('status', ['submitted', 'under_review']),
  ])

  // Monthly attendance — filter to branch
  const attRows = (attData.data ?? []) as any[]
  const branchAttRows = attRows.filter(r => branchIds.includes(r.students?.branch_id))
  const attTotal    = branchAttRows.length
  const attAttended = branchAttRows.filter(r => ['present', 'late', 'makeup'].includes(r.status)).length
  const monthlyAttPct = attTotal > 0 ? Math.round((attAttended / attTotal) * 100) : 0

  // Homework completion — derive from active group_students in branch
  const gsRows = (assignData.data ?? []) as any[]
  const branchGroupIds = [
    ...new Set(
      gsRows
        .filter(r => branchIds.includes(r.students?.branch_id))
        .map((r: any) => r.group_id as string)
    ),
  ]

  let homeworkCompletionPct = 0
  if (branchGroupIds.length > 0) {
    const [gcRes, subsRes] = await Promise.all([
      db.from('group_courses').select('id').in('group_id', branchGroupIds).eq('status', 'active'),
      db.from('group_students')
        .select('student_id')
        .in('group_id', branchGroupIds)
        .eq('status', 'active'),
    ])
    const gcIds     = (gcRes.data ?? []).map((r: any) => r.id as string)
    const studIds   = (subsRes.data ?? []).map((r: any) => r.student_id as string)

    if (gcIds.length > 0 && studIds.length > 0) {
      const [assignRes, subRes] = await Promise.all([
        db.from('assignments')
          .select('id', { count: 'exact', head: true })
          .in('schedule_id',
            (await db.from('schedules').select('id').in('group_course_id', gcIds)).data?.map((r: any) => r.id) ?? []
          )
          .is('module_id', null).is('lesson_id', null)
          .eq('status', 'published').is('deleted_at', null),
        db.from('submissions')
          .select('id', { count: 'exact', head: true })
          .in('student_id', studIds),
      ])
      const totalAssign  = (assignRes.count ?? 0) * studIds.length
      const totalSubmitted = subRes.count ?? 0
      homeworkCompletionPct = totalAssign > 0 ? Math.round((totalSubmitted / totalAssign) * 100) : 0
    }
  }

  // Parent satisfaction avg — filter to branch
  const feedRows = (feedbackData.data ?? []) as any[]
  const branchFeedRows = feedRows.filter(r => branchIds.includes(r.students?.branch_id))
  const parentSatisfactionAvg = branchFeedRows.length > 0
    ? Math.round((branchFeedRows.reduce((s, r) => s + r.rating, 0) / branchFeedRows.length) * 10) / 10
    : null

  // Cert ready — check which have no cert
  const certReadyRows = (certReadyData.data ?? []) as any[]
  const potentialCertIds = certReadyRows.map((r: any) => r.student_id as string)
  let certReadyCount = 0
  if (potentialCertIds.length > 0) {
    const { count: alreadyCerted } = await db
      .from('certificates')
      .select('student_id', { count: 'exact', head: true })
      .in('student_id', potentialCertIds)
      .eq('status', 'active')
    certReadyCount = potentialCertIds.length - (alreadyCerted ?? 0)
  }

  return {
    active_students:         activeStudents          ?? 0,
    monthly_attendance_pct:  monthlyAttPct,
    homework_completion_pct: Math.min(100, homeworkCompletionPct),
    parent_satisfaction_avg: parentSatisfactionAvg,
    pending_portfolio_count: pendingPortfolio        ?? 0,
    cert_ready_count:        Math.max(0, certReadyCount),
    open_messages_count:     openMessages            ?? 0,
  }
}

// ─── Today's Classes ──────────────────────────────────────────────────────────

export async function getTodaysClasses(branchIds: string[]): Promise<TodayClass[]> {
  if (!branchIds.length) return []

  const db  = createServiceClient()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const { data: schedRows } = await db
    .from('schedules')
    .select(`
      id, scheduled_at,
      group_courses!schedules_group_course_id_fkey(
        group_id,
        courses!group_courses_course_id_fkey(title),
        groups!group_courses_group_id_fkey(name),
        instructors!group_courses_instructor_id_fkey(
          users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
        )
      )
    `)
    .in('branch_id', branchIds)
    .gte('scheduled_at', todayStart)
    .lt('scheduled_at', todayEnd)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })

  if (!schedRows?.length) return []

  const groupIds = [...new Set(
    (schedRows as any[]).map(r => r.group_courses?.group_id as string).filter(Boolean)
  )]

  const studentCountMap = new Map<string, number>()
  if (groupIds.length > 0) {
    const { data: gsRows } = await db
      .from('group_students')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('status', 'active')
    for (const gs of gsRows ?? []) {
      const gid = (gs as any).group_id as string
      studentCountMap.set(gid, (studentCountMap.get(gid) ?? 0) + 1)
    }
  }

  return (schedRows as any[]).map(r => {
    const gc   = r.group_courses
    const prof = gc?.instructors?.users?.profiles
    const instrName = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null
    return {
      schedule_id:     r.id,
      group_name:      gc?.groups?.name    ?? '—',
      course_title:    gc?.courses?.title  ?? '—',
      instructor_name: instrName,
      scheduled_at:    r.scheduled_at,
      student_count:   studentCountMap.get(gc?.group_id) ?? 0,
    } satisfies TodayClass
  })
}

// ─── Today's Attendance Summary ───────────────────────────────────────────────

export async function getTodayAttendanceSummary(branchIds: string[]): Promise<TodayAttendance> {
  if (!branchIds.length) return { present: 0, absent: 0, late: 0 }

  const db         = createServiceClient()
  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const { data } = await db
    .from('attendance_records')
    .select('status, students!attendance_records_student_id_fkey(branch_id)')
    .gte('recorded_at', todayStart)
    .lt('recorded_at', todayEnd)

  const rows = ((data ?? []) as any[]).filter(r => branchIds.includes(r.students?.branch_id))

  return {
    present: rows.filter(r => r.status === 'present').length,
    absent:  rows.filter(r => r.status === 'absent').length,
    late:    rows.filter(r => r.status === 'late').length,
  }
}

// ─── At-Risk Students ─────────────────────────────────────────────────────────

export async function getAtRiskStudents(branchIds: string[], limit = 8): Promise<AtRiskStudent[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  const { data: progRows } = await db
    .from('student_course_progress')
    .select(`
      student_id, attendance_score, assignment_score, status,
      groups!student_course_progress_group_id_fkey(name),
      students!student_course_progress_student_id_fkey(
        branch_id,
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .eq('status', 'active')
    .or('attendance_score.lt.75,assignment_score.lt.60')
    .order('attendance_score', { ascending: true })
    .limit(limit * 3)

  const filtered = ((progRows ?? []) as any[]).filter(r =>
    branchIds.includes(r.students?.branch_id)
  ).slice(0, limit)

  return filtered.map(r => {
    const prof = r.students?.users?.profiles
    const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Student' : 'Student'
    const reasons: string[] = []
    if (r.attendance_score < 75)  reasons.push(`Attendance ${Math.round(r.attendance_score)}%`)
    if (r.assignment_score < 60)  reasons.push(`Homework ${Math.round(r.assignment_score)}%`)
    return {
      student_id:       r.student_id,
      student_name:     name,
      group_name:       r.groups?.name ?? null,
      attendance_score: r.attendance_score,
      assignment_score: r.assignment_score,
      risk_reasons:     reasons,
    } satisfies AtRiskStudent
  })
}

// ─── Portfolio Queue ───────────────────────────────────────────────────────────

export async function getPortfolioQueue(branchIds: string[], limit = 8): Promise<PortfolioQueueItem[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  // Get branch student ids
  const { data: studRows } = await db
    .from('students')
    .select('id')
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
  const studIds = (studRows ?? []).map((r: any) => r.id as string)
  if (!studIds.length) return []

  const { data: projRows } = await db
    .from('portfolio_projects')
    .select(`
      id, title, category, created_at, student_id,
      students!portfolio_projects_student_id_fkey(
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .in('student_id', studIds)
    .eq('status', 'pending_review')
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  return ((projRows ?? []) as any[]).map(r => {
    const prof = r.students?.users?.profiles
    const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Student' : 'Student'
    return {
      project_id:    r.id,
      project_title: r.title,
      student_name:  name,
      category:      r.category ?? null,
      created_at:    r.created_at,
    } satisfies PortfolioQueueItem
  })
}

// ─── Certificate-Ready Students ───────────────────────────────────────────────

export async function getCertReadyStudents(branchIds: string[], limit = 8): Promise<CertReadyStudent[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  const { data: progRows } = await db
    .from('student_course_progress')
    .select(`
      student_id, completion_percentage,
      groups!student_course_progress_group_id_fkey(name),
      courses!student_course_progress_course_id_fkey(title),
      students!student_course_progress_student_id_fkey(
        branch_id,
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .gte('completion_percentage', 90)
    .eq('status', 'active')
    .order('completion_percentage', { ascending: false })
    .limit(limit * 2)

  const branchRows = ((progRows ?? []) as any[]).filter(r =>
    branchIds.includes(r.students?.branch_id)
  )

  // Exclude already-certificated
  const candidateIds = branchRows.map(r => r.student_id as string)
  const certedIds    = new Set<string>()
  if (candidateIds.length > 0) {
    const { data: certRows } = await db
      .from('certificates')
      .select('student_id')
      .in('student_id', candidateIds)
      .eq('status', 'active')
    for (const c of certRows ?? []) certedIds.add((c as any).student_id)
  }

  return branchRows
    .filter(r => !certedIds.has(r.student_id))
    .slice(0, limit)
    .map(r => {
      const prof = r.students?.users?.profiles
      const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Student' : 'Student'
      return {
        student_id:     r.student_id,
        student_name:   name,
        group_name:     r.groups?.name   ?? null,
        course_title:   r.courses?.title ?? null,
        completion_pct: r.completion_percentage,
      } satisfies CertReadyStudent
    })
}

// ─── Instructor Performance ───────────────────────────────────────────────────

export async function getInstructorPerformance(branchIds: string[]): Promise<InstructorPerf[]> {
  if (!branchIds.length) return []

  const db = createServiceClient()

  // Get all active group_courses for branch with instructor info
  const { data: gcRows } = await db
    .from('group_courses')
    .select(`
      id, instructor_id, group_id,
      instructors!group_courses_instructor_id_fkey(
        id,
        users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      ),
      groups!group_courses_group_id_fkey(branch_id)
    `)
    .eq('status', 'active')
    .in('groups.branch_id', branchIds)

  const allGcRows = ((gcRows ?? []) as any[]).filter(r =>
    branchIds.includes(r.groups?.branch_id)
  )

  if (!allGcRows.length) return []

  // Group by instructor
  const instrMap = new Map<string, { name: string; gcIds: string[]; groupIds: string[] }>()
  for (const gc of allGcRows) {
    const id   = gc.instructor_id
    const prof = gc.instructors?.users?.profiles
    const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Instructor' : 'Instructor'
    if (!instrMap.has(id)) instrMap.set(id, { name, gcIds: [], groupIds: [] })
    const entry = instrMap.get(id)!
    entry.gcIds.push(gc.id)
    entry.groupIds.push(gc.group_id)
  }

  const instrIds   = [...instrMap.keys()]
  const allGcIds   = allGcRows.map(r => r.id as string)
  const allGroupIds = allGcRows.map(r => r.group_id as string)

  // Parallel fetch: schedules, submissions, portfolio
  const [schedRes, subRes, portRes, gsRes] = await Promise.all([
    // All completed schedules for these gcs
    db.from('schedules')
      .select('id, group_course_id, status')
      .in('group_course_id', allGcIds)
      .eq('status', 'completed'),

    // All submissions for students in these groups
    db.from('submissions')
      .select('id, status, assignments!submissions_assignment_id_fkey(schedule_id)')
      .in('status', ['submitted', 'under_review', 'resubmitted', 'graded', 'returned']),

    // Portfolio reviews
    db.from('portfolio_projects')
      .select('id, status, student_id')
      .in('status', ['pending_review', 'approved', 'needs_improvement', 'featured'])
      .eq('is_archived', false),

    // Active students per group
    db.from('group_students')
      .select('group_id, student_id')
      .in('group_id', allGroupIds)
      .eq('status', 'active'),
  ])

  const completedScheds = (schedRes.data ?? []) as any[]
  const allSubs         = (subRes.data ?? []) as any[]
  const allProjects     = (portRes.data ?? []) as any[]
  const gsRows2         = (gsRes.data ?? []) as any[]

  // Session feedback averages per instructor
  const schedIds = completedScheds.map(s => s.id as string)
  const feedbackMap = new Map<string, number[]>() // gcId → ratings
  if (schedIds.length > 0) {
    const { data: fbRows } = await db
      .from('session_feedback')
      .select('schedule_id, q1_score, q2_score, q3_score')
      .in('schedule_id', schedIds)
    for (const fb of (fbRows ?? []) as any[]) {
      const sched  = completedScheds.find(s => s.id === fb.schedule_id)
      if (!sched) continue
      const gcId   = sched.group_course_id
      const avg    = (fb.q1_score + fb.q2_score + fb.q3_score) / 3
      if (!feedbackMap.has(gcId)) feedbackMap.set(gcId, [])
      feedbackMap.get(gcId)!.push(avg)
    }
  }

  // Build per-instructor stats
  const result: InstructorPerf[] = []
  for (const [instrId, { name, gcIds, groupIds }] of instrMap) {
    const instrSchedIds = completedScheds
      .filter(s => gcIds.includes(s.group_course_id))
      .map(s => s.id as string)

    // Student count
    const instrStudIds = new Set(
      gsRows2.filter(gs => groupIds.includes(gs.group_id)).map(gs => gs.student_id as string)
    )

    // Avg student feedback
    const feedbackRatings = gcIds.flatMap(gcId => feedbackMap.get(gcId) ?? [])
    const avgRating = feedbackRatings.length > 0
      ? Math.round((feedbackRatings.reduce((s, r) => s + r, 0) / feedbackRatings.length) * 10) / 10
      : null

    // Homework review % = graded / (graded + pending review)
    const instrSubmissions = allSubs.filter(s => {
      const schedId = s.assignments?.schedule_id
      return schedId && instrSchedIds.includes(schedId)
    })
    const totalSubs  = instrSubmissions.length
    const gradedSubs = instrSubmissions.filter(s => s.status === 'graded').length
    const hwReviewPct = totalSubs > 0 ? Math.round((gradedSubs / totalSubs) * 100) : 100

    // Portfolio review %
    const instrStudArray = [...instrStudIds]
    const instrProjects  = allProjects.filter(p => instrStudArray.includes(p.student_id))
    const totalProjects  = instrProjects.length
    const reviewedProjects = instrProjects.filter(p => ['approved', 'needs_improvement', 'featured'].includes(p.status)).length
    const portReviewPct = totalProjects > 0 ? Math.round((reviewedProjects / totalProjects) * 100) : 100

    // Attendance rate = sessions with any attendance recorded / completed sessions
    let attRate = 100
    if (instrSchedIds.length > 0) {
      const { count: attSchedCount } = await db
        .from('attendance_records')
        .select('schedule_id', { count: 'exact', head: true })
        .in('schedule_id', instrSchedIds)
      const uniqueAttSched = attSchedCount ?? 0
      attRate = instrSchedIds.length > 0
        ? Math.round((uniqueAttSched / instrSchedIds.length) * 100)
        : 100
    }

    result.push({
      instructor_id:        instrId,
      instructor_name:      name,
      active_groups:        groupIds.length,
      active_students:      instrStudIds.size,
      avg_student_rating:   avgRating,
      homework_review_pct:  hwReviewPct,
      portfolio_review_pct: portReviewPct,
      attendance_rate:      Math.min(100, attRate),
    })
  }

  return result.sort((a, b) =>
    (b.avg_student_rating ?? 0) - (a.avg_student_rating ?? 0)
  )
}

// ─── Group performance metrics ────────────────────────────────────────────────

export interface GroupMetrics {
  group_id:        string
  attendance_avg:  number
  assignment_avg:  number
  portfolio_avg:   number
  health_score:    number
  student_count:   number
}

export async function getGroupMetrics(groupIds: string[]): Promise<Map<string, GroupMetrics>> {
  const result = new Map<string, GroupMetrics>()
  if (!groupIds.length) return result

  const db = createServiceClient()

  // Aggregate student_course_progress per group
  const { data: progRows } = await db
    .from('student_course_progress')
    .select('student_id, group_id, attendance_score, assignment_score, portfolio_score')
    .in('group_id', groupIds)
    .eq('status', 'active')

  const grouped = new Map<string, { att: number[]; assign: number[]; port: number[] }>()
  for (const row of (progRows ?? []) as any[]) {
    if (!grouped.has(row.group_id)) grouped.set(row.group_id, { att: [], assign: [], port: [] })
    const g = grouped.get(row.group_id)!
    g.att.push(row.attendance_score ?? 0)
    g.assign.push(row.assignment_score ?? 0)
    g.port.push(row.portfolio_score ?? 0)
  }

  for (const [gid, { att, assign, port }] of grouped) {
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0
    const attAvg  = avg(att)
    const assAvg  = avg(assign)
    const portAvg = avg(port)
    const health  = Math.round(attAvg * 0.4 + assAvg * 0.3 + portAvg * 0.2 + 100 * 0.1)
    result.set(gid, {
      group_id:       gid,
      attendance_avg: attAvg,
      assignment_avg: assAvg,
      portfolio_avg:  portAvg,
      health_score:   health,
      student_count:  att.length,
    })
  }

  return result
}

// ─── Portfolio counts by status ───────────────────────────────────────────────

export async function getPortfolioStatusCounts(
  branchIds: string[]
): Promise<Record<string, number>> {
  if (!branchIds.length) return {}

  const db = createServiceClient()
  const { data: studRows } = await db
    .from('students')
    .select('id')
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
  const studIds = (studRows ?? []).map((r: any) => r.id as string)
  if (!studIds.length) return {}

  const { data } = await db
    .from('portfolio_projects')
    .select('status')
    .in('student_id', studIds)
    .eq('is_archived', false)

  const counts: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) {
    counts[r.status] = (counts[r.status] ?? 0) + 1
  }
  return counts
}

// ─── Work Queues (Phase 3 — Dashboard as actionable work lists) ───────────────

export type QueueCategory =
  | 'collect_today'
  | 'renew_urgent'
  | 'attendance_risks'
  | 'contracts_near_exhaustion'
  | 'students_missing_groups'
  | 'inactive_students'

export type QueueSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface WorkQueueItem {
  queue_id:        string          // `${category}:${enrollment_id}` — stable, unique
  enrollment_id:   string
  student_id:      string
  student_name:    string
  student_code:    string | null
  group_id:        string | null   // raw null — never "No group"
  group_name:      string | null   // raw null — UI adds fallback label
  instructor_name: string | null
  parent_phone_1:  string | null
  value:           string          // primary display value (amount, sessions, days, etc.)
  sub:             string | null
  href:            string
  category:        QueueCategory
  severity:        QueueSeverity
}

export interface WorkQueues {
  collect_today:          WorkQueueItem[]   // overdue + due today
  renew_urgent:           WorkQueueItem[]   // 0-2 sessions remaining
  attendance_risks:       WorkQueueItem[]   // consec absences ≥ 3 or below 60%
  contracts_near_exhaustion: WorkQueueItem[] // 3-5 sessions left
  students_missing_groups: WorkQueueItem[]  // active contract, no group
  inactive_students:      WorkQueueItem[]   // no attendance 14+ days
}

export async function getWorkQueues(branchIds: string[]): Promise<WorkQueues> {
  if (!branchIds.length) {
    return {
      collect_today: [], renew_urgent: [], attendance_risks: [],
      contracts_near_exhaustion: [], students_missing_groups: [], inactive_students: [],
    }
  }

  const db           = createServiceClient()
  const today        = new Date().toISOString().slice(0, 10)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)

  // ── Raw row types (Supabase join shapes) ──────────────────────────────────
  interface RawEnrollStudents {
    student_code: string | null
    users: { email?: string; profiles: { first_name: string | null; last_name: string | null } | null } | null
  }
  interface RawEnrollRow {
    id: string
    student_id: string
    group_id: string | null
    enrolled_sessions: number | null
    remaining_sessions: number | null
    students: RawEnrollStudents | null
    groups: { name: string } | null
    group_courses: {
      instructors: {
        users: { profiles: { first_name: string | null; last_name: string | null } | null } | null
      } | null
    } | null
  }
  interface RawFinAccount {
    enrollment_id: string | null
    student_id: string
    remaining_amount: number | null
    next_due_date: string | null
  }
  interface RawAttRow {
    student_id: string
    recorded_at: string
    status: string
  }

  // Single pass: load ACTIVE enrollments with nested student / group / instructor
  const { data: enrollRows } = await db
    .from('student_enrollments')
    .select(`
      id, student_id, group_id, enrolled_sessions, remaining_sessions,
      students!student_enrollments_student_id_fkey(
        student_code,
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      ),
      groups!student_enrollments_group_id_fkey(name),
      group_courses!student_enrollments_group_course_id_fkey(
        instructors!group_courses_instructor_id_fkey(
          users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
        )
      )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'ACTIVE')
    .limit(1000)

  const enrollments = (enrollRows ?? []) as unknown as RawEnrollRow[]
  if (!enrollments.length) {
    return {
      collect_today: [], renew_urgent: [], attendance_risks: [],
      contracts_near_exhaustion: [], students_missing_groups: [], inactive_students: [],
    }
  }

  const enrollIds  = enrollments.map(e => e.id)
  const studentIds = [...new Set(enrollments.map(e => e.student_id))]

  const [accRes, attRes] = await Promise.all([
    // Legacy fallback: some accounts may be linked by student_id only (pre-enrollment era)
    db.from('student_financial_accounts')
      .select('enrollment_id, student_id, remaining_amount, next_due_date')
      .or(`enrollment_id.in.(${enrollIds.join(',')}),student_id.in.(${studentIds.join(',')})`),

    db.from('attendance_records')
      .select('student_id, recorded_at, status')
      .in('student_id', studentIds)
      .gte('recorded_at', sixtyDaysAgo)
      .order('recorded_at', { ascending: false })
      .limit(5000),
  ])

  // Financial lookup: exact by enrollment first, student fallback for legacy rows
  const accByEnroll  = new Map<string, RawFinAccount>()
  const accByStudent = new Map<string, RawFinAccount>()
  for (const a of (accRes.data ?? []) as unknown as RawFinAccount[]) {
    if (a.enrollment_id) accByEnroll.set(a.enrollment_id, a)
    if (!accByStudent.has(a.student_id)) accByStudent.set(a.student_id, a)
  }

  // Consecutive-absence count per student (records ordered DESC: newest first)
  const consAbsMap = new Map<string, number>()
  const lastAttMap  = new Map<string, string>()
  const POSITIVE    = new Set(['present', 'late', 'makeup'])
  const seenPos     = new Set<string>()

  for (const ar of (attRes.data ?? []) as unknown as RawAttRow[]) {
    if (!lastAttMap.has(ar.student_id)) lastAttMap.set(ar.student_id, ar.recorded_at)
    if (seenPos.has(ar.student_id)) continue
    if (POSITIVE.has(ar.status)) {
      seenPos.add(ar.student_id)
    } else {
      consAbsMap.set(ar.student_id, (consAbsMap.get(ar.student_id) ?? 0) + 1)
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)

  const toItem = (
    e: RawEnrollRow,
    category: QueueCategory,
    severity: QueueSeverity,
    value: string,
    sub: string | null,
  ): WorkQueueItem => {
    const s      = e.students ?? ({} as RawEnrollStudents)
    const prof   = (s.users?.profiles ?? {}) as { first_name: string | null; last_name: string | null }
    const instrP = e.group_courses?.instructors?.users?.profiles
    return {
      queue_id:        `${category}:${e.id}`,
      enrollment_id:   e.id,
      student_id:      e.student_id,
      student_name:    [prof.first_name, prof.last_name].filter(Boolean).join(' ') || s.users?.email || 'Unknown',
      student_code:    s.student_code ?? null,
      group_id:        e.group_id,
      group_name:      e.groups?.name ?? null,
      instructor_name: instrP ? [instrP.first_name, instrP.last_name].filter(Boolean).join(' ') || null : null,
      parent_phone_1:  null,
      value,
      sub,
      href:            `/portal/team-leader/students/${e.student_id}`,
      category,
      severity,
    }
  }

  const collect_today:             WorkQueueItem[] = []
  const renew_urgent:              WorkQueueItem[] = []
  const attendance_risks:          WorkQueueItem[] = []
  const contracts_near_exhaustion: WorkQueueItem[] = []
  const students_missing_groups:   WorkQueueItem[] = []
  const inactive_students:         WorkQueueItem[] = []

  // Per-student dedup sets for student-level queues
  const seenRisk     = new Set<string>()
  const seenInactive = new Set<string>()
  const seenMissing  = new Set<string>()

  for (const e of enrollments) {
    const acc       = accByEnroll.get(e.id) ?? accByStudent.get(e.student_id)
    const remaining = acc ? Number(acc.remaining_amount ?? 0) : 0
    const dueDate   = acc?.next_due_date ?? null
    const daysOvr   = dueDate && dueDate <= today && remaining > 0
      ? Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
      : 0
    const sessLeft  = Number(e.remaining_sessions ?? 0)
    const sessTotal = Number(e.enrolled_sessions ?? 0)
    const cons      = consAbsMap.get(e.student_id) ?? 0
    const lastAtt   = lastAttMap.get(e.student_id) ?? null
    const daysSince = lastAtt
      ? Math.floor((Date.now() - new Date(lastAtt).getTime()) / 86400000)
      : null

    // 1. Collect today — per enrollment (each overdue balance is an independent action)
    if (remaining > 0 && (daysOvr > 0 || dueDate === today)) {
      const sev: QueueSeverity = daysOvr > 7 ? 'critical' : daysOvr > 0 ? 'high' : 'medium'
      collect_today.push(toItem(e, 'collect_today', sev,
        `EGP ${fmt(remaining)}`, daysOvr > 0 ? `${daysOvr}d overdue` : 'Due today'))
    }

    // 2. Renew urgent — per enrollment
    if (sessTotal > 0 && sessLeft <= 2) {
      renew_urgent.push(toItem(e, 'renew_urgent', sessLeft <= 0 ? 'critical' : 'high',
        sessLeft <= 0 ? 'Exhausted' : `${sessLeft} left`, `of ${sessTotal}`))
    }

    // 3. Attendance risks — per student (worst enrollment wins via first-seen order)
    if (cons >= 3 && !seenRisk.has(e.student_id)) {
      seenRisk.add(e.student_id)
      attendance_risks.push(toItem(e, 'attendance_risks', cons >= 5 ? 'critical' : 'high',
        `${cons} absences`, 'consecutive'))
    }

    // 4. Contracts near exhaustion — per enrollment
    if (sessTotal > 0 && sessLeft >= 3 && sessLeft <= 5) {
      contracts_near_exhaustion.push(toItem(e, 'contracts_near_exhaustion', 'medium',
        `${sessLeft} left`, `of ${sessTotal}`))
    }

    // 5. Missing groups — per student (avoid N rows for same unassigned student)
    if (!e.group_id && !seenMissing.has(e.student_id)) {
      seenMissing.add(e.student_id)
      students_missing_groups.push(toItem(e, 'students_missing_groups', 'low',
        'Unassigned', remaining > 0 ? `EGP ${fmt(remaining)} balance` : null))
    }

    // 6. Inactive students — per student
    if (daysSince !== null && daysSince >= 14 && !seenInactive.has(e.student_id)) {
      seenInactive.add(e.student_id)
      inactive_students.push(toItem(e, 'inactive_students', daysSince >= 30 ? 'high' : 'medium',
        `${daysSince}d inactive`, lastAtt ? `Last: ${lastAtt.slice(0, 10)}` : null))
    }
  }

  const SEV: Record<QueueSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const byUrgency = (a: WorkQueueItem, b: WorkQueueItem) =>
    (SEV[b.severity] - SEV[a.severity]) || a.queue_id.localeCompare(b.queue_id)

  collect_today.sort((a, b) =>
    (parseInt(b.sub ?? '0') - parseInt(a.sub ?? '0')) || byUrgency(a, b))
  inactive_students.sort((a, b) =>
    (parseInt(b.value) - parseInt(a.value)) || byUrgency(a, b))
  attendance_risks.sort(byUrgency)
  renew_urgent.sort(byUrgency)
  contracts_near_exhaustion.sort(byUrgency)
  students_missing_groups.sort(byUrgency)

  return {
    collect_today:             collect_today.slice(0, 20),
    renew_urgent:              renew_urgent.slice(0, 20),
    attendance_risks:          attendance_risks.slice(0, 20),
    contracts_near_exhaustion: contracts_near_exhaustion.slice(0, 20),
    students_missing_groups:   students_missing_groups.slice(0, 20),
    inactive_students:         inactive_students.slice(0, 20),
  }
}

// ─── Sprint 51: Instructor Operations Center ──────────────────────────────────
// Combines InstructorPerf (existing) with v_instructor_operations (new view).
// Falls back gracefully if view not yet deployed.

export interface InstructorOpsRow extends InstructorPerf {
  revenue_managed:    number
  outstanding_amount: number
  retention_pct:      number | null
  risk_students:      number
  critical_students:  number
  health_score:       number  // 0-100 composite
}

export async function getInstructorOpsData(branchIds: string[]): Promise<InstructorOpsRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // Try new view first
  const { data: viewRows, error: viewErr } = await db
    .from('v_instructor_operations')
    .select('instructor_id, active_students, revenue_managed, outstanding_amount, retention_pct, risk_students, critical_students')
    .in('branch_id', branchIds)

  // Existing performance data
  const perfRows = await getInstructorPerformance(branchIds)

  // Merge
  const viewMap = new Map<string, any>()
  if (!viewErr) {
    for (const r of (viewRows ?? []) as any[]) viewMap.set(r.instructor_id, r)
  }

  return perfRows.map(p => {
    const v = viewMap.get(p.instructor_id)
    const retPct  = v?.retention_pct  != null ? Number(v.retention_pct)  : null
    const riskStu = v?.risk_students  != null ? Number(v.risk_students)  : 0
    const revenue = v?.revenue_managed != null ? Number(v.revenue_managed) : 0

    // Health score: 40% attendance_rate + 30% avg_rating(÷5) + 20% retention + 10% no risk students
    const ratingNorm  = p.avg_student_rating != null ? (p.avg_student_rating / 5) * 100 : 70
    const retNorm     = retPct != null ? retPct : 70
    const riskPenalty = Math.min(30, riskStu * 5)
    const health = Math.round(
      p.attendance_rate * 0.40 +
      ratingNorm        * 0.30 +
      retNorm           * 0.20 +
      Math.max(0, 100 - riskPenalty) * 0.10
    )

    return {
      ...p,
      active_students:    v?.active_students  != null ? Number(v.active_students) : p.active_students,
      revenue_managed:    revenue,
      outstanding_amount: v?.outstanding_amount != null ? Number(v.outstanding_amount) : 0,
      retention_pct:      retPct,
      risk_students:      riskStu,
      critical_students:  v?.critical_students != null ? Number(v.critical_students) : 0,
      health_score:       Math.min(100, Math.max(0, health)),
    }
  }).sort((a, b) => b.health_score - a.health_score)
}

// ─── Sprint 51: Branch performance summary ────────────────────────────────────

export interface BranchPerfRow {
  branch_id:              string
  branch_name:            string
  active_students:        number
  active_contracts:       number
  revenue_contracted:     number
  revenue_collected:      number
  outstanding:            number
  overdue_count:          number
  collection_rate_pct:    number
  retention_pct:          number | null
  risk_students:          number
  renewal_urgent:         number
  active_instructors:     number
  operational_health_score: number
  open_tasks:             number
  critical_tasks:         number
}

export async function getBranchPerformance(branchIds: string[]): Promise<BranchPerfRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data, error } = await db
    .from('v_executive_overview')
    .select('*')
    .in('branch_id', branchIds)

  if (error || !data) return []

  return ((data ?? []) as any[]).map(r => ({
    branch_id:               r.branch_id,
    branch_name:             r.branch_name,
    active_students:         Number(r.active_students ?? 0),
    active_contracts:        Number(r.active_contracts ?? 0),
    revenue_contracted:      Number(r.revenue_contracted ?? 0),
    revenue_collected:       Number(r.revenue_collected ?? 0),
    outstanding:             Number(r.outstanding ?? 0),
    overdue_count:           Number(r.overdue_count ?? 0),
    collection_rate_pct:     Number(r.collection_rate_pct ?? 0),
    retention_pct:           r.retention_pct != null ? Number(r.retention_pct) : null,
    risk_students:           Number(r.risk_students ?? 0),
    renewal_urgent:          Number(r.renewal_urgent ?? 0),
    active_instructors:      Number(r.active_instructors ?? 0),
    operational_health_score: Number(r.operational_health_score ?? 50),
    open_tasks:              Number(r.open_tasks ?? 0),
    critical_tasks:          Number(r.critical_tasks ?? 0),
  }))
}
