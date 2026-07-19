import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  TLStudentsOverview,
  TLGroupHealth,
  TLGroupsOverview,
  TLBranchStat,
  TLLeadsOverview,
  TLAssignmentKPIs,
  TLAssignmentGroupRow,
  TLAssignmentInstructorRow,
  TLAssignmentOverview,
  OperationalAlert,
  TLStudentCoverageGap,
  TLEvaluationOverview,
  TLEvaluationGroupRow,
  TLEvaluationInstructorRow,
  TLNotesOverview,
  TLNotesGroupRow,
  TLNotesInstructorRow,
  TLCompetitionOverview,
  TLCompetitionGroupRow,
  TLCompetitionInstructorRow,
  TLCompetitionActivityItem,
  TLAcademicOverviewKPIs,
} from './types'

// ── Students Overview ─────────────────────────────────────────────────────────

export async function getTLStudentsOverview(branchIds: string[]): Promise<TLStudentsOverview> {
  if (!branchIds.length) {
    return { total_active: 0, new_this_month: 0, inactive: 0, attendance_avg: 0, at_risk_count: 0 }
  }

  const db = createServiceClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [activeRes, newRes, inactiveRes, attRes, atRiskRes] = await Promise.all([
    // Total active
    db.from('students').select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null),

    // New this month
    db.from('students').select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null)
      .gte('created_at', monthStart),

    // Inactive
    db.from('students').select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds).eq('status', 'inactive').is('deleted_at', null),

    // Attendance records this month for branch students
    db.from('attendance_records')
      .select('status, students!attendance_records_student_id_fkey(branch_id)')
      .gte('recorded_at', monthStart),

    // At-risk: completion < 70 or attendance < 75
    db.from('student_course_progress')
      .select('student_id, students!student_course_progress_student_id_fkey(branch_id)')
      .eq('status', 'active')
      .or('completion_percentage.lt.70,attendance_score.lt.75'),
  ])

  // Compute attendance avg scoped to branch
  const attRows = ((attRes.data ?? []) as any[]).filter(r =>
    branchIds.includes(r.students?.branch_id)
  )
  const attTotal    = attRows.length
  const attAttended = attRows.filter(r => ['present', 'late', 'makeup'].includes(r.status)).length
  const attendanceAvg = attTotal > 0 ? Math.round((attAttended / attTotal) * 100) : 0

  // At-risk scoped to branch
  const atRiskCount = ((atRiskRes.data ?? []) as any[]).filter(r =>
    branchIds.includes(r.students?.branch_id)
  ).length

  return {
    total_active:   activeRes.count   ?? 0,
    new_this_month: newRes.count      ?? 0,
    inactive:       inactiveRes.count ?? 0,
    attendance_avg: attendanceAvg,
    at_risk_count:  atRiskCount,
  }
}

// ── Groups Overview ───────────────────────────────────────────────────────────

export async function getTLGroupsOverview(branchIds: string[]): Promise<TLGroupsOverview> {
  if (!branchIds.length) {
    return { total_active: 0, without_instructor: 0, without_course: 0, low_attendance: 0, groups: [] }
  }

  const db = createServiceClient()

  // Fetch active groups in branches
  const { data: groupRows } = await db
    .from('groups')
    .select(`
      id, name, status,
      branches!groups_branch_id_fkey(name)
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)

  if (!groupRows?.length) {
    return { total_active: 0, without_instructor: 0, without_course: 0, low_attendance: 0, groups: [] }
  }

  const groupIds = (groupRows as any[]).map(g => g.id as string)

  // Batch: group_instructors, active group_courses, student counts, progress averages
  const [giRes, gcRes, gsRes, progRes] = await Promise.all([
    db.from('group_instructors').select('group_id').in('group_id', groupIds),
    db.from('group_courses').select('group_id').in('group_id', groupIds).eq('status', 'active'),
    db.from('group_students').select('group_id').in('group_id', groupIds).eq('status', 'active'),
    db.from('student_course_progress')
      .select('group_id, attendance_score')
      .in('group_id', groupIds)
      .eq('status', 'active'),
  ])

  const hasInstructorSet = new Set((giRes.data ?? []).map((r: any) => r.group_id as string))
  const hasCourseSet     = new Set((gcRes.data ?? []).map((r: any) => r.group_id as string))

  const studentCountMap: Record<string, number> = {}
  for (const gs of (gsRes.data ?? []) as any[]) {
    studentCountMap[gs.group_id] = (studentCountMap[gs.group_id] ?? 0) + 1
  }

  const attMap: Record<string, number[]> = {}
  for (const p of (progRes.data ?? []) as any[]) {
    if (!attMap[p.group_id]) attMap[p.group_id] = []
    attMap[p.group_id].push(Number(p.attendance_score))
  }
  const avgAtt = (gid: string) => {
    const arr = attMap[gid] ?? []
    return arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0
  }

  const groups: TLGroupHealth[] = (groupRows as any[]).map(g => ({
    group_id:          g.id,
    group_name:        g.name,
    branch_name:       g.branches?.name ?? null,
    student_count:     studentCountMap[g.id] ?? 0,
    has_instructor:    hasInstructorSet.has(g.id),
    has_active_course: hasCourseSet.has(g.id),
    attendance_avg:    avgAtt(g.id),
    status:            g.status,
  }))

  return {
    total_active:       groups.length,
    without_instructor: groups.filter(g => !g.has_instructor).length,
    without_course:     groups.filter(g => !g.has_active_course).length,
    low_attendance:     groups.filter(g => g.attendance_avg > 0 && g.attendance_avg < 70).length,
    groups:             groups.sort((a, b) => a.attendance_avg - b.attendance_avg),
  }
}

// ── Leads Overview ────────────────────────────────────────────────────────────

export async function getTLLeadsOverview(branchIds: string[]): Promise<TLLeadsOverview> {
  if (!branchIds.length) {
    return {
      total: 0, new_this_month: 0, converted_this_month: 0,
      conversion_rate_pct: 0, overdue_followups: 0,
      avg_days_to_convert: null, by_source: [], by_status: [],
    }
  }

  const db       = createServiceClient()
  const now      = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: allLeads } = await db
    .from('leads')
    .select('id, status, source, created_at, next_follow_up_at, converted_at')
    .in('branch_id', branchIds)

  const rows = (allLeads ?? []) as any[]

  const total               = rows.length
  const newThisMonth        = rows.filter(r => r.created_at >= monthStart).length
  const convertedThisMonth  = rows.filter(r =>
    r.status === 'converted' && r.converted_at && r.converted_at >= monthStart
  ).length
  const conversionRate      = total > 0 ? Math.round((rows.filter(r => r.status === 'converted').length / total) * 100) : 0
  const overdueFollowups    = rows.filter(r =>
    r.next_follow_up_at && r.next_follow_up_at < todayStr && r.status !== 'converted' && r.status !== 'lost'
  ).length

  // Avg days to convert
  const convertedWithDates = rows.filter(r => r.status === 'converted' && r.converted_at && r.created_at)
  const avgDays = convertedWithDates.length > 0
    ? Math.round(
        convertedWithDates.reduce((s, r) => {
          const diff = (new Date(r.converted_at).getTime() - new Date(r.created_at).getTime()) / 86400000
          return s + diff
        }, 0) / convertedWithDates.length
      )
    : null

  // By source
  const sourceMap: Record<string, number> = {}
  for (const r of rows) {
    const src = r.source || 'unknown'
    sourceMap[src] = (sourceMap[src] ?? 0) + 1
  }
  const bySource = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  // By status
  const statusMap: Record<string, number> = {}
  for (const r of rows) {
    statusMap[r.status] = (statusMap[r.status] ?? 0) + 1
  }
  const byStatus = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  return {
    total,
    new_this_month:       newThisMonth,
    converted_this_month: convertedThisMonth,
    conversion_rate_pct:  conversionRate,
    overdue_followups:    overdueFollowups,
    avg_days_to_convert:  avgDays,
    by_source:            bySource,
    by_status:            byStatus,
  }
}

// ── Branch Comparison (multi-branch TLs) ─────────────────────────────────────

export async function getTLBranchComparison(branchIds: string[]): Promise<TLBranchStat[]> {
  if (branchIds.length < 2) return []

  const db = createServiceClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: branches } = await db
    .from('branches').select('id, name').in('id', branchIds).order('name')
  if (!branches?.length) return []

  // Parallel fetch for all branches combined, then split
  const [studRows, groupRows, finRows, attRows, atRiskRows, leadsRows] = await Promise.all([
    db.from('students').select('id, branch_id, status').in('branch_id', branchIds).is('deleted_at', null),
    db.from('groups').select('id, branch_id').in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null),
    db.from('student_financial_accounts')
      .select('branch_id, net_amount, paid_amount').in('branch_id', branchIds),
    db.from('attendance_records')
      .select('status, students!attendance_records_student_id_fkey(branch_id)')
      .gte('recorded_at', monthStart),
    db.from('student_course_progress')
      .select('student_id, students!student_course_progress_student_id_fkey(branch_id)')
      .eq('status', 'active').or('completion_percentage.lt.70,attendance_score.lt.75'),
    db.from('leads').select('branch_id, status, created_at')
      .in('branch_id', branchIds).gte('created_at', monthStart),
  ])

  const studMap:    Record<string, { active: number }> = {}
  const groupMap:   Record<string, number> = {}
  const finMap:     Record<string, { net: number; paid: number }> = {}
  const attMap:     Record<string, { total: number; attended: number }> = {}
  const riskMap:    Record<string, Set<string>> = {}
  const leadsMap:   Record<string, number> = {}

  for (const r of (studRows.data ?? []) as any[]) {
    if (!studMap[r.branch_id]) studMap[r.branch_id] = { active: 0 }
    if (r.status === 'active') studMap[r.branch_id].active++
  }
  for (const r of (groupRows.data ?? []) as any[]) {
    groupMap[r.branch_id] = (groupMap[r.branch_id] ?? 0) + 1
  }
  for (const r of (finRows.data ?? []) as any[]) {
    if (!finMap[r.branch_id]) finMap[r.branch_id] = { net: 0, paid: 0 }
    finMap[r.branch_id].net  += Number(r.net_amount)
    finMap[r.branch_id].paid += Number(r.paid_amount)
  }
  for (const r of (attRows.data ?? []) as any[]) {
    const bid = r.students?.branch_id
    if (!bid || !branchIds.includes(bid)) continue
    if (!attMap[bid]) attMap[bid] = { total: 0, attended: 0 }
    attMap[bid].total++
    if (['present', 'late', 'makeup'].includes(r.status)) attMap[bid].attended++
  }
  for (const r of (atRiskRows.data ?? []) as any[]) {
    const bid = r.students?.branch_id
    if (!bid || !branchIds.includes(bid)) continue
    if (!riskMap[bid]) riskMap[bid] = new Set()
    riskMap[bid].add(r.student_id)
  }
  for (const r of (leadsRows.data ?? []) as any[]) {
    leadsMap[r.branch_id] = (leadsMap[r.branch_id] ?? 0) + 1
  }

  return (branches as any[]).map(b => {
    const fin  = finMap[b.id]  ?? { net: 0, paid: 0 }
    const att  = attMap[b.id]  ?? { total: 0, attended: 0 }
    const rate = fin.net > 0 ? Math.round((fin.paid / fin.net) * 100) : 0
    const attAvg = att.total > 0 ? Math.round((att.attended / att.total) * 100) : 0
    return {
      branch_id:       b.id,
      branch_name:     b.name,
      active_students: studMap[b.id]?.active ?? 0,
      active_groups:   groupMap[b.id] ?? 0,
      collection_rate: rate,
      attendance_avg:  attAvg,
      at_risk_count:   riskMap[b.id]?.size ?? 0,
      leads_new:       leadsMap[b.id] ?? 0,
    }
  })
}

// ── Assignment Analytics ──────────────────────────────────────────────────────

export async function getTLAssignmentOverview(branchIds: string[]): Promise<TLAssignmentOverview> {
  const empty: TLAssignmentOverview = {
    kpis: { total_published: 0, overdue_count: 0, avg_completion_pct: 0, pending_review_count: 0, grading_delay_count: 0 },
    by_group: [],
    by_instructor: [],
  }
  if (!branchIds.length) return empty

  const db  = createServiceClient()
  const now = new Date().toISOString()
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()

  // Resolve group_course IDs for branches
  const { data: gcRows } = await db
    .from('group_courses')
    .select(`
      id, instructor_id,
      groups!group_courses_group_id_fkey(id, name, branch_id, branches!groups_branch_id_fkey(name)),
      instructors!group_courses_instructor_id_fkey(
        id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .eq('status', 'active')
    .in('groups.branch_id', branchIds)

  const branchGcRows = ((gcRows ?? []) as any[]).filter(r =>
    branchIds.includes(r.groups?.branch_id)
  )
  if (!branchGcRows.length) return empty

  const gcIds = branchGcRows.map(r => r.id as string)

  // Schedules and their assignments
  const { data: schedRows } = await db
    .from('schedules')
    .select('id, group_course_id')
    .in('group_course_id', gcIds)

  const schedIds = (schedRows ?? []).map((r: any) => r.id as string)

  if (!schedIds.length) return empty

  const schedGcMap: Record<string, string> = {}
  for (const s of (schedRows ?? []) as any[]) schedGcMap[s.id] = s.group_course_id

  // Published assignments for these schedules
  const { data: assignRows } = await db
    .from('assignments')
    .select('id, title, type, due_at, schedule_id, module_id')
    .in('schedule_id', schedIds)
    .eq('status', 'published')
    .is('deleted_at', null)

  const assignments = (assignRows ?? []) as any[]
  if (!assignments.length) return empty

  const assignIds  = assignments.map(a => a.id as string)
  const overdueIds = assignments.filter(a => a.due_at && a.due_at < now).map(a => a.id as string)

  // Submissions
  const { data: subRows } = await db
    .from('submissions')
    .select('id, assignment_id, student_id, status, submitted_at')
    .in('assignment_id', assignIds)

  const submissions = (subRows ?? []) as any[]

  // Active students per group
  const groupIds = [...new Set(branchGcRows.map(r => r.groups?.id as string).filter(Boolean))]
  const { data: gsRows } = await db
    .from('group_students')
    .select('group_id, student_id')
    .in('group_id', groupIds)
    .eq('status', 'active')

  const groupStudentMap: Record<string, Set<string>> = {}
  for (const gs of (gsRows ?? []) as any[]) {
    if (!groupStudentMap[gs.group_id]) groupStudentMap[gs.group_id] = new Set()
    groupStudentMap[gs.group_id].add(gs.student_id)
  }

  // Build assignment → group_course → group mapping
  const assignGcMap: Record<string, string> = {}
  for (const a of assignments) {
    if (a.schedule_id) assignGcMap[a.id] = schedGcMap[a.schedule_id] ?? ''
  }

  // KPIs
  const totalPublished     = assignments.length
  const overdueCount       = overdueIds.length
  const pendingReviewCount = submissions.filter(s => s.status === 'submitted' || s.status === 'resubmitted').length
  const gradingDelayCount  = submissions.filter(s =>
    (s.status === 'submitted' || s.status === 'resubmitted') &&
    s.submitted_at && s.submitted_at < threeDaysAgo
  ).length

  // Avg completion: submitted / (total assignments × enrolled students per group)
  let totalExpected = 0
  let totalSubmitted = 0
  for (const gc of branchGcRows) {
    const gcAssigns = assignments.filter(a => assignGcMap[a.id] === gc.id)
    const studCount = groupStudentMap[gc.groups?.id ?? '']?.size ?? 0
    totalExpected  += gcAssigns.length * studCount
    const gcAssignIds = new Set(gcAssigns.map(a => a.id as string))
    totalSubmitted += submissions.filter(s => gcAssignIds.has(s.assignment_id)).length
  }
  const avgCompletionPct = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 0

  // By group breakdown
  const gcGroupMap = new Map(branchGcRows.map(r => [r.id as string, r.groups as any]))
  const gcInstrMap = new Map(branchGcRows.map(r => [r.id as string, r.instructors as any]))
  const groupAgg: Record<string, { name: string; branchName: string | null; aCount: number; sCount: number; gCount: number; overdueC: number; expected: number }> = {}

  for (const gc of branchGcRows) {
    const g = gcGroupMap.get(gc.id)
    if (!g) continue
    const gid = g.id as string
    if (!groupAgg[gid]) groupAgg[gid] = { name: g.name, branchName: g.branches?.name ?? null, aCount: 0, sCount: 0, gCount: 0, overdueC: 0, expected: 0 }

    const gcAssigns = assignments.filter(a => assignGcMap[a.id] === gc.id)
    const studCount = groupStudentMap[gid]?.size ?? 0
    const gcAssignIds = new Set(gcAssigns.map(a => a.id as string))
    const gcSubs = submissions.filter(s => gcAssignIds.has(s.assignment_id))

    groupAgg[gid].aCount   += gcAssigns.length
    groupAgg[gid].expected += gcAssigns.length * studCount
    groupAgg[gid].sCount   += gcSubs.length
    groupAgg[gid].gCount   += gcSubs.filter(s => s.status === 'graded').length
    groupAgg[gid].overdueC += gcAssigns.filter(a => a.due_at && a.due_at < now).length
  }

  const byGroup: TLAssignmentGroupRow[] = Object.entries(groupAgg)
    .map(([gid, agg]) => ({
      group_id:         gid,
      group_name:       agg.name,
      branch_name:      agg.branchName,
      assignment_count: agg.aCount,
      submission_count: agg.sCount,
      graded_count:     agg.gCount,
      completion_pct:   agg.expected > 0 ? Math.round((agg.sCount / agg.expected) * 100) : 0,
      overdue_count:    agg.overdueC,
    }))
    .sort((a, b) => a.completion_pct - b.completion_pct)

  // By instructor breakdown
  const instrAgg: Record<string, { name: string; pending: number; delay: number; aCount: number; expected: number; sCount: number }> = {}

  for (const gc of branchGcRows) {
    const instr = gcInstrMap.get(gc.id)
    if (!instr?.id) continue
    const iid = instr.id as string
    const prof = instr.users?.profiles
    const iname = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') : 'Unknown'
    if (!instrAgg[iid]) instrAgg[iid] = { name: iname, pending: 0, delay: 0, aCount: 0, expected: 0, sCount: 0 }

    const gcAssigns = assignments.filter(a => assignGcMap[a.id] === gc.id)
    const gcAssignIds = new Set(gcAssigns.map(a => a.id as string))
    const gcSubs = submissions.filter(s => gcAssignIds.has(s.assignment_id))
    const studCount = groupStudentMap[gc.groups?.id ?? '']?.size ?? 0

    instrAgg[iid].aCount   += gcAssigns.length
    instrAgg[iid].expected += gcAssigns.length * studCount
    instrAgg[iid].sCount   += gcSubs.length
    instrAgg[iid].pending  += gcSubs.filter(s => s.status === 'submitted' || s.status === 'resubmitted').length
    instrAgg[iid].delay    += gcSubs.filter(s =>
      (s.status === 'submitted' || s.status === 'resubmitted') &&
      s.submitted_at && s.submitted_at < threeDaysAgo
    ).length
  }

  const byInstructor: TLAssignmentInstructorRow[] = Object.entries(instrAgg)
    .map(([iid, agg]) => ({
      instructor_id:     iid,
      instructor_name:   agg.name,
      pending_review:    agg.pending,
      grading_delay:     agg.delay,
      assignment_count:  agg.aCount,
      avg_completion_pct: agg.expected > 0 ? Math.round((agg.sCount / agg.expected) * 100) : 0,
    }))
    .sort((a, b) => b.pending_review - a.pending_review)

  return {
    kpis: {
      total_published:      totalPublished,
      overdue_count:        overdueCount,
      avg_completion_pct:   avgCompletionPct,
      pending_review_count: pendingReviewCount,
      grading_delay_count:  gradingDelayCount,
    },
    by_group:      byGroup,
    by_instructor: byInstructor,
  }
}

// ── Operational Alerts ────────────────────────────────────────────────────────

export async function getOperationalAlerts(branchIds: string[]): Promise<OperationalAlert[]> {
  if (!branchIds.length) return []

  const db      = createServiceClient()
  const now     = new Date()
  const today   = now.toISOString().slice(0, 10)
  const ago14   = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const ago30   = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const ago3    = new Date(Date.now() - 3 * 86400000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    overdueFinRes,
    brokenPromRes,
    noAttRes,
    atRiskRes,
    overdueLeadsRes,
    groupsNoInstrRes,
  ] = await Promise.all([
    // Finance: overdue accounts > 30 days
    db.from('student_financial_accounts')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .eq('status', 'OVERDUE')
      .lte('next_due_date', ago30),

    // Finance: broken promises this month
    db.from('payment_promises')
      .select(
        'id',
        { count: 'exact', head: true }
      )
      .eq('status', 'BROKEN')
      .gte('updated_at', monthStart)
      .in(
        'account_id',
        (await db.from('student_financial_accounts').select('id').in('branch_id', branchIds)
          .then(r => (r.data ?? []).map((a: any) => a.id as string)))
      ),

    // Attendance: sessions with status=completed but no attendance records
    db.from('schedules')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .eq('status', 'completed')
      .gte('scheduled_at', monthStart)
      .not('id', 'in', `(SELECT DISTINCT schedule_id FROM attendance_records WHERE schedule_id IS NOT NULL)`),

    // At-risk students
    db.from('student_course_progress')
      .select('student_id, students!student_course_progress_student_id_fkey(branch_id)', { count: 'exact' })
      .eq('status', 'active')
      .or('completion_percentage.lt.70,attendance_score.lt.75'),

    // Leads: overdue follow-ups
    db.from('leads')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .lt('next_follow_up_at', today)
      .not('status', 'in', '("CONVERTED","LOST")')
      .not('next_follow_up_at', 'is', null),

    // Groups without instructor
    db.from('groups')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .eq('status', 'active')
      .is('deleted_at', null)
      .not('id', 'in', `(SELECT DISTINCT group_id FROM group_instructors)`),
  ])

  const alerts: OperationalAlert[] = []

  const atRiskBranch = ((atRiskRes.data ?? []) as any[]).filter(r =>
    branchIds.includes(r.students?.branch_id)
  ).length

  // Finance alerts
  const overdue30Count = overdueFinRes.count ?? 0
  if (overdue30Count > 0) {
    alerts.push({
      id: 'finance_overdue_30',
      severity: 'critical',
      category: 'finance',
      title: `${overdue30Count} accounts overdue 30+ days`,
      detail: 'These students need immediate collection follow-up.',
      count: overdue30Count,
      action_href: '/portal/team-leader/finance?status=OVERDUE',
    })
  }

  const brokenProm = brokenPromRes.count ?? 0
  if (brokenProm > 0) {
    alerts.push({
      id: 'finance_broken_promises',
      severity: 'warning',
      category: 'finance',
      title: `${brokenProm} broken payment promises`,
      detail: 'Promises were made but not fulfilled this month.',
      count: brokenProm,
      action_href: '/portal/team-leader/finance',
    })
  }

  // Attendance alerts
  const noAttCount = noAttRes.count ?? 0
  if (noAttCount > 0) {
    alerts.push({
      id: 'attendance_missing',
      severity: 'warning',
      category: 'attendance',
      title: `${noAttCount} sessions missing attendance`,
      detail: 'Completed sessions this month with no attendance records.',
      count: noAttCount,
      action_href: '/portal/team-leader/attendance',
    })
  }

  // Student at-risk alerts
  if (atRiskBranch > 0) {
    alerts.push({
      id: 'students_at_risk',
      severity: atRiskBranch >= 5 ? 'critical' : 'warning',
      category: 'attendance',
      title: `${atRiskBranch} at-risk students`,
      detail: 'Students with completion < 70% or attendance < 75%.',
      count: atRiskBranch,
      action_href: '/portal/team-leader/analytics?tab=students',
    })
  }

  // Leads alerts
  const overdueLeads = overdueLeadsRes.count ?? 0
  if (overdueLeads > 0) {
    alerts.push({
      id: 'leads_overdue_followup',
      severity: 'warning',
      category: 'leads',
      title: `${overdueLeads} leads need follow-up`,
      detail: 'Leads with overdue follow-up dates.',
      count: overdueLeads,
      action_href: '/portal/team-leader/leads',
    })
  }

  // Group health alerts
  const noInstrCount = groupsNoInstrRes.count ?? 0
  if (noInstrCount > 0) {
    alerts.push({
      id: 'groups_no_instructor',
      severity: 'warning',
      category: 'groups',
      title: `${noInstrCount} active groups without instructor`,
      detail: 'These groups need an instructor assigned.',
      count: noInstrCount,
      action_href: '/portal/team-leader/groups',
    })
  }

  // Sort: critical first, then warning, then info
  const sev: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => sev[a.severity] - sev[b.severity])
}

// ── Academic Oversight (Evaluations / Notes / Competitions) ────────────────────
//
// Shared branch-scoped roster resolution, mirroring the group_courses → groups
// → group_students resolution used by getTLAssignmentOverview above, so
// evaluation/notes/competition coverage is computed against the exact same
// "active student taught by an active instructor in one of my branches" set.

const EVAL_RECENT_WINDOW_DAYS   = 30  // an evaluation "covers" a student for this many days
const NOTES_RECENT_WINDOW_DAYS  = 30  // same cadence for notes
const ACTIVITY_FEED_DAYS        = 7   // "recently submitted/created" feed window
const ACTIVITY_FEED_LIMIT       = 15
const COVERAGE_GAP_LIMIT        = 30
const ATTENTION_THRESHOLD_PCT   = 50  // below this, a group/instructor "requires attention"

interface BranchAcademicRoster {
  studentIds:        string[]
  studentGroupMap:   Map<string, string>
  groupInfoMap:      Map<string, { name: string; branch_name: string | null }>
  groupStudentIds:   Map<string, Set<string>>
  instructorByGroup: Map<string, { id: string; name: string }>
}

async function resolveBranchAcademicRoster(
  branchIds: string[],
  db: ReturnType<typeof createServiceClient>
): Promise<BranchAcademicRoster> {
  const empty: BranchAcademicRoster = {
    studentIds: [], studentGroupMap: new Map(), groupInfoMap: new Map(),
    groupStudentIds: new Map(), instructorByGroup: new Map(),
  }
  if (!branchIds.length) return empty

  const { data: gcRows } = await db
    .from('group_courses')
    .select(`
      id, instructor_id,
      groups!group_courses_group_id_fkey(id, name, branch_id, branches!groups_branch_id_fkey(name)),
      instructors!group_courses_instructor_id_fkey(
        id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .eq('status', 'active')
    .in('groups.branch_id', branchIds)

  const branchGcRows = ((gcRows ?? []) as any[]).filter(r => branchIds.includes(r.groups?.branch_id))
  if (!branchGcRows.length) return empty

  const groupIds = [...new Set(branchGcRows.map(r => r.groups?.id as string).filter(Boolean))]

  const { data: gsRows } = await db
    .from('group_students')
    .select('group_id, student_id')
    .in('group_id', groupIds)
    .eq('status', 'active')

  const groupStudentIds = new Map<string, Set<string>>()
  const studentGroupMap = new Map<string, string>()
  for (const gs of (gsRows ?? []) as any[]) {
    if (!groupStudentIds.has(gs.group_id)) groupStudentIds.set(gs.group_id, new Set())
    groupStudentIds.get(gs.group_id)!.add(gs.student_id)
    studentGroupMap.set(gs.student_id, gs.group_id)
  }

  const groupInfoMap      = new Map<string, { name: string; branch_name: string | null }>()
  const instructorByGroup = new Map<string, { id: string; name: string }>()
  for (const gc of branchGcRows) {
    const g = gc.groups
    if (!g?.id) continue
    groupInfoMap.set(g.id, { name: g.name, branch_name: g.branches?.name ?? null })
    const instr = gc.instructors
    if (instr?.id) {
      const prof = instr.users?.profiles
      const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown'
      instructorByGroup.set(g.id, { id: instr.id, name })
    }
  }

  return {
    studentIds: [...studentGroupMap.keys()],
    studentGroupMap,
    groupInfoMap,
    groupStudentIds,
    instructorByGroup,
  }
}

// Resolves display names for a set of student ids and a set of user (author) ids
// in two batched queries — shared by the evaluation/notes/competition overviews.
async function resolveStudentAndAuthorNames(
  db: ReturnType<typeof createServiceClient>,
  studentIds: string[],
  authorIds: string[]
): Promise<{ studentNames: Map<string, string>; authorNames: Map<string, string> }> {
  const [studentRows, authorRows] = await Promise.all([
    studentIds.length
      ? db.from('students')
          .select('id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
          .in('id', studentIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as any[] }),
    authorIds.length
      ? db.from('users')
          .select('id, profiles!profiles_user_id_fkey(first_name, last_name)')
          .in('id', authorIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const studentNames = new Map<string, string>()
  for (const r of (studentRows.data ?? []) as any[]) {
    const p = r.users?.profiles
    studentNames.set(r.id, p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown')
  }

  const authorNames = new Map<string, string>()
  for (const r of (authorRows.data ?? []) as any[]) {
    const p = r.profiles
    authorNames.set(r.id, p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Staff' : 'Staff')
  }

  return { studentNames, authorNames }
}

// Aggregates a per-student "covered" boolean set into by-group / by-instructor
// completion rows — shared shape/math for evaluations and notes.
function aggregateCoverageByGroupAndInstructor(
  roster: BranchAcademicRoster,
  coveredStudentIds: Set<string>
): { byGroup: { group_id: string; group_name: string; branch_name: string | null; student_count: number; covered_count: number; completion_pct: number }[]
     byInstructor: { instructor_id: string; instructor_name: string; student_count: number; covered_count: number; completion_pct: number }[] } {
  const byGroup = [...roster.groupStudentIds.entries()]
    .map(([groupId, studSet]) => {
      const info = roster.groupInfoMap.get(groupId)
      if (!info) return null
      const coveredCount = [...studSet].filter(sid => coveredStudentIds.has(sid)).length
      return {
        group_id: groupId, group_name: info.name, branch_name: info.branch_name,
        student_count: studSet.size, covered_count: coveredCount,
        completion_pct: studSet.size > 0 ? Math.round((coveredCount / studSet.size) * 100) : 0,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.completion_pct - b.completion_pct)

  const instrAgg = new Map<string, { name: string; studentIds: Set<string> }>()
  for (const [groupId, studSet] of roster.groupStudentIds) {
    const instr = roster.instructorByGroup.get(groupId)
    if (!instr) continue
    if (!instrAgg.has(instr.id)) instrAgg.set(instr.id, { name: instr.name, studentIds: new Set() })
    for (const sid of studSet) instrAgg.get(instr.id)!.studentIds.add(sid)
  }
  const byInstructor = [...instrAgg.entries()]
    .map(([id, agg]) => {
      const coveredCount = [...agg.studentIds].filter(sid => coveredStudentIds.has(sid)).length
      return {
        instructor_id: id, instructor_name: agg.name,
        student_count: agg.studentIds.size, covered_count: coveredCount,
        completion_pct: agg.studentIds.size > 0 ? Math.round((coveredCount / agg.studentIds.size) * 100) : 0,
      }
    })
    .sort((a, b) => a.completion_pct - b.completion_pct)

  return { byGroup, byInstructor }
}

function buildCoverageGaps(
  roster: BranchAcademicRoster,
  missingIds: string[],
  overdueIds: string[],
  lastActivityByStudent: Map<string, string>,
  studentNames: Map<string, string>
): TLStudentCoverageGap[] {
  const toGap = (id: string, status: 'missing' | 'overdue'): TLStudentCoverageGap => {
    const groupId = roster.studentGroupMap.get(id) ?? null
    return {
      student_id:       id,
      student_name:     studentNames.get(id) ?? 'Unknown',
      group_id:         groupId,
      group_name:       groupId ? roster.groupInfoMap.get(groupId)?.name ?? null : null,
      status,
      last_activity_at: lastActivityByStudent.get(id) ?? null,
    }
  }
  return [
    ...missingIds.map(id => toGap(id, 'missing')),
    ...overdueIds.map(id => toGap(id, 'overdue')),
  ].slice(0, COVERAGE_GAP_LIMIT)
}

// ── Evaluation Oversight ─────────────────────────────────────────────────────

export async function getTLEvaluationOverview(branchIds: string[]): Promise<TLEvaluationOverview> {
  const empty: TLEvaluationOverview = {
    kpis: { total_active_students: 0, evaluated_recent_count: 0, completion_pct: 0, missing_count: 0, overdue_count: 0, recent_evaluations_count: 0 },
    by_group: [], by_instructor: [], students_missing: [], recent_activity: [],
  }
  if (!branchIds.length) return empty

  const db     = createServiceClient()
  const roster = await resolveBranchAcademicRoster(branchIds, db)
  if (!roster.studentIds.length) return empty

  const recentCutoff   = new Date(Date.now() - EVAL_RECENT_WINDOW_DAYS * 86400000).toISOString()
  const activityCutoff = new Date(Date.now() - ACTIVITY_FEED_DAYS * 86400000).toISOString()

  const { data: evalRows } = await db
    .from('student_evaluations')
    .select('id, student_id, criterion, author_id, evaluated_at, created_at')
    .in('student_id', roster.studentIds)
    .is('deleted_at', null)
    .order('evaluated_at', { ascending: false })

  const evaluations = (evalRows ?? []) as any[]

  const latestByStudent = new Map<string, string>()
  for (const e of evaluations) {
    const cur = latestByStudent.get(e.student_id)
    if (!cur || e.evaluated_at > cur) latestByStudent.set(e.student_id, e.evaluated_at)
  }

  const evaluatedIds = new Set(latestByStudent.keys())
  const missingIds   = roster.studentIds.filter(id => !evaluatedIds.has(id))
  const overdueIds   = roster.studentIds.filter(id => evaluatedIds.has(id) && (latestByStudent.get(id) as string) < recentCutoff)
  const coveredIds   = new Set(roster.studentIds.filter(id => evaluatedIds.has(id) && (latestByStudent.get(id) as string) >= recentCutoff))

  const recentEvals = evaluations.filter(e => e.created_at >= activityCutoff).slice(0, ACTIVITY_FEED_LIMIT)

  const { studentNames, authorNames } = await resolveStudentAndAuthorNames(
    db,
    [...new Set([...missingIds, ...overdueIds, ...recentEvals.map(e => e.student_id as string)])],
    [...new Set(recentEvals.map(e => e.author_id as string))]
  )

  const { byGroup, byInstructor } = aggregateCoverageByGroupAndInstructor(roster, coveredIds)

  const evaluationGroupRows: TLEvaluationGroupRow[] = byGroup.map(g => ({
    group_id: g.group_id, group_name: g.group_name, branch_name: g.branch_name,
    student_count: g.student_count, evaluated_count: g.covered_count, completion_pct: g.completion_pct,
  }))
  const evaluationInstructorRows: TLEvaluationInstructorRow[] = byInstructor.map(i => ({
    instructor_id: i.instructor_id, instructor_name: i.instructor_name,
    student_count: i.student_count, evaluated_count: i.covered_count, completion_pct: i.completion_pct,
  }))

  return {
    kpis: {
      total_active_students:    roster.studentIds.length,
      evaluated_recent_count:   coveredIds.size,
      completion_pct:           roster.studentIds.length > 0 ? Math.round((coveredIds.size / roster.studentIds.length) * 100) : 0,
      missing_count:            missingIds.length,
      overdue_count:            overdueIds.length,
      recent_evaluations_count: recentEvals.length,
    },
    by_group:      evaluationGroupRows,
    by_instructor: evaluationInstructorRows,
    students_missing: buildCoverageGaps(roster, missingIds, overdueIds, latestByStudent, studentNames),
    recent_activity: recentEvals.map(e => ({
      id: e.id, student_id: e.student_id, student_name: studentNames.get(e.student_id) ?? 'Unknown',
      criterion: e.criterion, author_name: authorNames.get(e.author_id) ?? 'Staff', evaluated_at: e.evaluated_at,
    })),
  }
}

// ── Student Notes Oversight ─────────────────────────────────────────────────

export async function getTLNotesOverview(branchIds: string[]): Promise<TLNotesOverview> {
  const empty: TLNotesOverview = {
    kpis: { total_active_students: 0, noted_recent_count: 0, completion_pct: 0, missing_count: 0, overdue_count: 0, recent_notes_count: 0 },
    by_group: [], by_instructor: [], students_missing: [], recent_activity: [],
  }
  if (!branchIds.length) return empty

  const db     = createServiceClient()
  const roster = await resolveBranchAcademicRoster(branchIds, db)
  if (!roster.studentIds.length) return empty

  const recentCutoff   = new Date(Date.now() - NOTES_RECENT_WINDOW_DAYS * 86400000).toISOString()
  const activityCutoff = new Date(Date.now() - ACTIVITY_FEED_DAYS * 86400000).toISOString()

  // Content is never selected — this aggregate only needs existence/category/
  // severity/timing, never the note text (see TLNotesOverview doc comment).
  const { data: noteRows } = await db
    .from('student_notes')
    .select('id, student_id, category, severity, author_id, created_at')
    .in('student_id', roster.studentIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const notes = (noteRows ?? []) as any[]

  const latestByStudent = new Map<string, string>()
  for (const n of notes) {
    const cur = latestByStudent.get(n.student_id)
    if (!cur || n.created_at > cur) latestByStudent.set(n.student_id, n.created_at)
  }

  const notedIds   = new Set(latestByStudent.keys())
  const missingIds = roster.studentIds.filter(id => !notedIds.has(id))
  const overdueIds = roster.studentIds.filter(id => notedIds.has(id) && (latestByStudent.get(id) as string) < recentCutoff)
  const coveredIds = new Set(roster.studentIds.filter(id => notedIds.has(id) && (latestByStudent.get(id) as string) >= recentCutoff))

  const recentNotes = notes.filter(n => n.created_at >= activityCutoff).slice(0, ACTIVITY_FEED_LIMIT)

  const { studentNames, authorNames } = await resolveStudentAndAuthorNames(
    db,
    [...new Set([...missingIds, ...overdueIds, ...recentNotes.map(n => n.student_id as string)])],
    [...new Set(recentNotes.map(n => n.author_id as string))]
  )

  const { byGroup, byInstructor } = aggregateCoverageByGroupAndInstructor(roster, coveredIds)

  const notesGroupRows: TLNotesGroupRow[] = byGroup.map(g => ({
    group_id: g.group_id, group_name: g.group_name, branch_name: g.branch_name,
    student_count: g.student_count, noted_count: g.covered_count, completion_pct: g.completion_pct,
  }))
  const notesInstructorRows: TLNotesInstructorRow[] = byInstructor.map(i => ({
    instructor_id: i.instructor_id, instructor_name: i.instructor_name,
    student_count: i.student_count, noted_count: i.covered_count, completion_pct: i.completion_pct,
  }))

  return {
    kpis: {
      total_active_students: roster.studentIds.length,
      noted_recent_count:    coveredIds.size,
      completion_pct:        roster.studentIds.length > 0 ? Math.round((coveredIds.size / roster.studentIds.length) * 100) : 0,
      missing_count:         missingIds.length,
      overdue_count:         overdueIds.length,
      recent_notes_count:    recentNotes.length,
    },
    by_group:      notesGroupRows,
    by_instructor: notesInstructorRows,
    students_missing: buildCoverageGaps(roster, missingIds, overdueIds, latestByStudent, studentNames),
    recent_activity: recentNotes.map(n => ({
      id: n.id, student_id: n.student_id, student_name: studentNames.get(n.student_id) ?? 'Unknown',
      category: n.category, severity: n.severity, author_name: authorNames.get(n.author_id) ?? 'Staff', created_at: n.created_at,
    })),
  }
}

// ── Competition Oversight (visibility only) ─────────────────────────────────
// student_competitions has no status/registration field — it is a results log,
// not a live event system. "Participation" here means "has ≥1 recorded result
// ever"; "recent" means recorded in the current calendar year; "winners" means
// rank or award is set. There is no data to distinguish "preparing" students.

export async function getTLCompetitionOverview(branchIds: string[]): Promise<TLCompetitionOverview> {
  const empty: TLCompetitionOverview = {
    kpis: { total_active_students: 0, participating_count: 0, participation_pct: 0, winners_count: 0, recent_count: 0 },
    by_group: [], by_instructor: [], winners: [], recent_activity: [],
  }
  if (!branchIds.length) return empty

  const db     = createServiceClient()
  const roster = await resolveBranchAcademicRoster(branchIds, db)
  if (!roster.studentIds.length) return empty

  const currentYear = new Date().getFullYear()

  const { data: compRows } = await db
    .from('student_competitions')
    .select('id, student_id, competition_name, year, rank, award, created_at')
    .in('student_id', roster.studentIds)
    .order('created_at', { ascending: false })

  const competitions = (compRows ?? []) as any[]

  const participatingIds = new Set(competitions.map(c => c.student_id as string))
  const winnerRows        = competitions.filter(c => c.rank || c.award)
  const recentYearRows    = competitions.filter(c => c.year === currentYear)

  const { studentNames } = await resolveStudentAndAuthorNames(
    db,
    [...new Set(competitions.slice(0, ACTIVITY_FEED_LIMIT * 2).map(c => c.student_id as string))],
    []
  )

  const { byGroup, byInstructor } = aggregateCoverageByGroupAndInstructor(roster, participatingIds)

  const competitionGroupRows: TLCompetitionGroupRow[] = byGroup.map(g => ({
    group_id: g.group_id, group_name: g.group_name, branch_name: g.branch_name,
    student_count: g.student_count, participating_count: g.covered_count, participation_pct: g.completion_pct,
  }))
  const competitionInstructorRows: TLCompetitionInstructorRow[] = byInstructor.map(i => ({
    instructor_id: i.instructor_id, instructor_name: i.instructor_name,
    student_count: i.student_count, participating_count: i.covered_count, participation_pct: i.completion_pct,
  }))

  const toActivityItem = (c: any): TLCompetitionActivityItem => ({
    id: c.id, student_id: c.student_id, student_name: studentNames.get(c.student_id) ?? 'Unknown',
    competition_name: c.competition_name, year: c.year, rank: c.rank ?? null, award: c.award ?? null, created_at: c.created_at,
  })

  return {
    kpis: {
      total_active_students: roster.studentIds.length,
      participating_count:   participatingIds.size,
      participation_pct:     roster.studentIds.length > 0 ? Math.round((participatingIds.size / roster.studentIds.length) * 100) : 0,
      winners_count:          new Set(winnerRows.map(w => w.student_id)).size,
      recent_count:           recentYearRows.length,
    },
    by_group:        competitionGroupRows,
    by_instructor:   competitionInstructorRows,
    winners:         winnerRows.slice(0, ACTIVITY_FEED_LIMIT).map(toActivityItem),
    recent_activity: competitions.slice(0, ACTIVITY_FEED_LIMIT).map(toActivityItem),
  }
}

// ── Compact cross-domain Academic Overview (dashboard composite) ───────────
// Pure composition over the overviews above plus the existing assignment
// overview — no new business logic, only aggregation of already-computed rows.

export async function getTLAcademicOverviewKPIs(branchIds: string[]): Promise<TLAcademicOverviewKPIs> {
  const empty: TLAcademicOverviewKPIs = {
    evaluation_completion_pct: 0, notes_completion_pct: 0, homework_completion_pct: 0,
    competition_participation_pct: 0, students_missing_evaluation: 0, students_missing_notes: 0,
    groups_requiring_attention: 0, instructors_requiring_attention: 0,
  }
  if (!branchIds.length) return empty

  const [evalOv, notesOv, compOv, assignOv] = await Promise.all([
    getTLEvaluationOverview(branchIds),
    getTLNotesOverview(branchIds),
    getTLCompetitionOverview(branchIds),
    getTLAssignmentOverview(branchIds),
  ])

  const lowGroups = new Set<string>([
    ...evalOv.by_group.filter(g => g.completion_pct < ATTENTION_THRESHOLD_PCT).map(g => g.group_id),
    ...notesOv.by_group.filter(g => g.completion_pct < ATTENTION_THRESHOLD_PCT).map(g => g.group_id),
  ])
  const lowInstructors = new Set<string>([
    ...evalOv.by_instructor.filter(i => i.completion_pct < ATTENTION_THRESHOLD_PCT).map(i => i.instructor_id),
    ...notesOv.by_instructor.filter(i => i.completion_pct < ATTENTION_THRESHOLD_PCT).map(i => i.instructor_id),
  ])

  return {
    evaluation_completion_pct:       evalOv.kpis.completion_pct,
    notes_completion_pct:            notesOv.kpis.completion_pct,
    homework_completion_pct:         assignOv.kpis.avg_completion_pct,
    competition_participation_pct:   compOv.kpis.participation_pct,
    students_missing_evaluation:     evalOv.kpis.missing_count,
    students_missing_notes:          notesOv.kpis.missing_count,
    groups_requiring_attention:      lowGroups.size,
    instructors_requiring_attention: lowInstructors.size,
  }
}
