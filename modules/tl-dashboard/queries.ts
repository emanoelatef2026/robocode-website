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
  let feedbackMap = new Map<string, number[]>() // gcId → ratings
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

// ─── Branch-filtered parents list ────────────────────────────────────────────

export interface TLParentListItem {
  id:              string
  user_id:         string
  first_name:      string | null
  last_name:       string | null
  email:           string | null
  phone:           string | null
  student_count:   number
  // CRM enrichment
  student_ids:     string[]
  total_remaining: number
  has_overdue:     boolean
  risk_level:      'HIGH' | 'MEDIUM' | 'LOW' | null
  // Parent health score (0-100)
  // Based on: payment compliance, no overdue, number of active contracts
  health_score:    number
  renewal_candidates: number   // students with ≤ 2 sessions remaining
}

export async function listParentsByBranch(
  branchIds: string[],
  { page = 1, perPage = 30, search = '' }: { page?: number; perPage?: number; search?: string } = {}
): Promise<{ data: TLParentListItem[]; total: number; page: number; perPage: number; totalPages: number }> {
  if (!branchIds.length) return { data: [], total: 0, page, perPage, totalPages: 0 }

  const db = createServiceClient()

  // 1. Get active students in this branch
  const { data: studRows } = await db
    .from('students')
    .select('id')
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(2000)
  const studIds = (studRows ?? []).map((r: any) => r.id as string)
  if (!studIds.length) return { data: [], total: 0, page, perPage, totalPages: 0 }

  // 2. Get parent→student links
  const { data: psRows } = await db
    .from('parent_students')
    .select('parent_id, student_id')
    .in('student_id', studIds)
    .limit(2000)

  // Build parent→student mapping
  const parentToStudents = new Map<string, string[]>()
  for (const ps of (psRows ?? []) as any[]) {
    const pid = ps.parent_id as string
    if (!parentToStudents.has(pid)) parentToStudents.set(pid, [])
    parentToStudents.get(pid)!.push(ps.student_id as string)
  }

  const parentIds = [...parentToStudents.keys()]
  if (!parentIds.length) return { data: [], total: 0, page, perPage, totalPages: 0 }

  // 3. Fetch financial data for all student IDs
  const { data: accRows } = await db
    .from('student_financial_accounts')
    .select('student_id, remaining_amount, status')
    .in('student_id', studIds)
  const finByStudent = new Map<string, { remaining: number; overdue: boolean }>()
  for (const a of (accRows ?? []) as any[]) {
    const existing = finByStudent.get(a.student_id) ?? { remaining: 0, overdue: false }
    finByStudent.set(a.student_id, {
      remaining: existing.remaining + Number(a.remaining_amount ?? 0),
      overdue:   existing.overdue || a.status === 'OVERDUE',
    })
  }

  // 4. Fetch parents with profile
  const { data: parentData, count } = await db
    .from('parents')
    .select(`
      id, user_id,
      users!parents_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name))
    `, { count: 'exact' })
    .in('id', parentIds)
    .order('id')
    .range((page - 1) * perPage, page * perPage - 1)

  let rows: TLParentListItem[] = ((parentData ?? []) as any[]).map(r => {
    const prof    = r.users?.profiles
    const sIds    = parentToStudents.get(r.id) ?? []
    let totalRem  = 0
    let hasOverdue = false

    for (const sid of sIds) {
      const fin = finByStudent.get(sid)
      if (fin) { totalRem += fin.remaining; if (fin.overdue) hasOverdue = true }
    }

    const riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | null =
      hasOverdue ? 'HIGH' :
      totalRem > 0 ? 'MEDIUM' :
      null

    // Parent health score 0-100:
    // 100 = no overdue, no balance → fully paid up
    //  80 = has balance but not overdue
    //  50 = overdue
    //   0 = blocked
    const healthScore =
      hasOverdue ? 50 :
      totalRem > 0 ? 80 :
      100

    return {
      id:            r.id,
      user_id:       r.user_id,
      first_name:    prof?.first_name ?? null,
      last_name:     prof?.last_name  ?? null,
      email:         r.users?.email   ?? null,
      phone:         r.users?.phone   ?? null,
      student_count: sIds.length,
      student_ids:   sIds,
      total_remaining: totalRem,
      has_overdue:   hasOverdue,
      risk_level:    riskLevel,
      health_score:  healthScore,
      renewal_candidates: 0,   // computed from enrollment data separately
    }
  })

  // Client-side search (name/email/phone match)
  if (search) {
    const lower = search.toLowerCase()
    rows = rows.filter(r => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ').toLowerCase()
      return (
        name.includes(lower) ||
        (r.email?.toLowerCase().includes(lower) ?? false) ||
        (r.phone?.includes(search) ?? false)
      )
    })
  }

  const total = count ?? rows.length
  return { data: rows, total, page, perPage, totalPages: Math.ceil(total / perPage) }
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

export interface WorkQueueItem {
  student_id:       string
  student_name:     string
  student_code:     string | null
  group_name:       string | null
  instructor_name:  string | null
  parent_phone_1:   string | null
  value:            string   // primary display value (amount, sessions, days, etc.)
  sub:              string | null
  href:             string
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

  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // Single pass: load ACTIVE enrollments with finance + attendance aggregates
  const { data: enrollRows } = await db
    .from('student_enrollments')
    .select(`
      id, student_id, group_id, enrolled_sessions, consumed_sessions, remaining_sessions,
      financial_status, start_date,
      students!student_enrollments_student_id_fkey(
        student_code, emergency_contact,
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

  const enrollments = (enrollRows ?? []) as any[]
  if (!enrollments.length) {
    return {
      collect_today: [], renew_urgent: [], attendance_risks: [],
      contracts_near_exhaustion: [], students_missing_groups: [], inactive_students: [],
    }
  }

  // Load financial accounts for these enrollments
  const enrollIds    = enrollments.map(e => e.id as string)
  const studentIds   = [...new Set(enrollments.map(e => e.student_id as string))]

  const [accRes, attRes] = await Promise.all([
    db.from('student_financial_accounts')
      .select('enrollment_id, student_id, remaining_amount, status, next_due_date')
      .or(`enrollment_id.in.(${enrollIds.join(',')}),student_id.in.(${studentIds.join(',')})`),

    // Last attendance per student
    db.from('attendance_records')
      .select('student_id, recorded_at, status')
      .in('student_id', studentIds)
      .order('recorded_at', { ascending: false }),
  ])

  // Maps
  const accByEnroll = new Map<string, any>()
  const accByStudent = new Map<string, any>()
  for (const a of (accRes.data ?? []) as any[]) {
    if (a.enrollment_id) accByEnroll.set(a.enrollment_id, a)
    else if (!accByStudent.has(a.student_id)) accByStudent.set(a.student_id, a)
  }

  // Consecutive absences per student (from most recent)
  const consAbsMap = new Map<string, number>()
  const lastAttMap  = new Map<string, string>()
  const POSITIVE = new Set(['present', 'late', 'makeup'])
  const seenStu  = new Set<string>()

  for (const ar of (attRes.data ?? []) as any[]) {
    if (!lastAttMap.has(ar.student_id)) lastAttMap.set(ar.student_id, ar.recorded_at)
    if (seenStu.has(ar.student_id)) continue
    // Count consecutive absences from most-recent backward
    let cons = consAbsMap.get(ar.student_id) ?? 0
    if (POSITIVE.has(ar.status)) { seenStu.add(ar.student_id) }
    else { consAbsMap.set(ar.student_id, cons + 1) }
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)

  const toItem = (e: any, value: string, sub: string | null): WorkQueueItem => {
    const s    = e.students     ?? {}
    const prof = s.users?.profiles ?? {}
    const ec   = (s.emergency_contact ?? {}) as Record<string, string>
    const gc   = e.group_courses ?? null
    const instrP = gc?.instructors?.users?.profiles
    return {
      student_id:      e.student_id,
      student_name:    [prof.first_name, prof.last_name].filter(Boolean).join(' ') || s.users?.email || 'Unknown',
      student_code:    s.student_code ?? null,
      group_name:      e.groups?.name ?? null,
      instructor_name: instrP ? [instrP.first_name, instrP.last_name].filter(Boolean).join(' ') || null : null,
      parent_phone_1:  ec.phone1 ?? null,
      value,
      sub,
      href: `/portal/team-leader/students/${e.student_id}`,
    }
  }

  const collect_today:          WorkQueueItem[] = []
  const renew_urgent:           WorkQueueItem[] = []
  const attendance_risks:       WorkQueueItem[] = []
  const contracts_near_exhaustion: WorkQueueItem[] = []
  const students_missing_groups: WorkQueueItem[] = []
  const inactive_students:       WorkQueueItem[] = []

  for (const e of enrollments) {
    const acc   = accByEnroll.get(e.id) ?? accByStudent.get(e.student_id)
    const remaining = acc ? Number(acc.remaining_amount) : 0
    const daysOvr   = acc?.next_due_date && acc.next_due_date <= today && remaining > 0
      ? Math.floor((Date.now() - new Date(acc.next_due_date).getTime()) / 86400000)
      : 0

    const sessLeft = Number(e.remaining_sessions ?? 0)
    const sessTotal = Number(e.enrolled_sessions ?? 0)
    const cons  = consAbsMap.get(e.student_id) ?? 0
    const lastAtt = lastAttMap.get(e.student_id) ?? null
    const daysSinceLast = lastAtt
      ? Math.floor((Date.now() - new Date(lastAtt).getTime()) / 86400000)
      : null

    // 1. Collect today (overdue or due today with balance)
    if (remaining > 0 && (daysOvr > 0 || acc?.next_due_date === today)) {
      collect_today.push(toItem(e, `EGP ${fmt(remaining)}`, daysOvr > 0 ? `${daysOvr}d overdue` : 'Due today'))
    }

    // 2. Renew urgent (0-2 sessions left, finite package)
    if (sessTotal > 0 && sessLeft <= 2) {
      renew_urgent.push(toItem(e, sessLeft <= 0 ? 'Exhausted' : `${sessLeft} left`, `of ${sessTotal}`))
    }

    // 3. Attendance risks (consec absences ≥ 3)
    if (cons >= 3) {
      attendance_risks.push(toItem(e, `${cons} absences`, 'consecutive'))
    }

    // 4. Contracts near exhaustion (3-5 sessions left)
    if (sessTotal > 0 && sessLeft >= 3 && sessLeft <= 5) {
      contracts_near_exhaustion.push(toItem(e, `${sessLeft} left`, `of ${sessTotal}`))
    }

    // 5. Students missing groups (no group_id)
    if (!e.group_id) {
      students_missing_groups.push(toItem(e, 'No group', remaining > 0 ? `EGP ${fmt(remaining)} balance` : null))
    }

    // 6. Inactive students (14+ days without attendance)
    if (daysSinceLast !== null && daysSinceLast >= 14) {
      inactive_students.push(toItem(e, `${daysSinceLast}d inactive`, lastAtt ? `Last: ${lastAtt.slice(0,10)}` : null))
    }
  }

  // Sort each queue by urgency
  collect_today.sort((a, b) => {
    const aD = parseInt(a.sub ?? '0')
    const bD = parseInt(b.sub ?? '0')
    return bD - aD
  })
  inactive_students.sort((a, b) => parseInt(b.value) - parseInt(a.value))

  return {
    collect_today:           collect_today.slice(0, 20),
    renew_urgent:            renew_urgent.slice(0, 20),
    attendance_risks:        attendance_risks.slice(0, 20),
    contracts_near_exhaustion: contracts_near_exhaustion.slice(0, 20),
    students_missing_groups: students_missing_groups.slice(0, 20),
    inactive_students:       inactive_students.slice(0, 20),
  }
}
