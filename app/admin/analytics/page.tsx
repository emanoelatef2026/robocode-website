import { createServiceClient }     from '@/lib/supabase/service'
import { requireAuth }             from '@/modules/rbac/guards'
import { redirect }                from 'next/navigation'
import {
  resolveGroupFilter,
  listAtRiskStudents,
  listCertificateReadiness,
  listMissingAssignments,
  listSemestersForAnalytics,
  listGroupPerformance,
  listCoursePerformance,
}                                  from '@/modules/analytics/queries'
import { getFinanceKPIs, getBranchFinanceStats } from '@/modules/finance/queries'
import Pagination                  from '@/components/admin/Pagination'
import Link                        from 'next/link'
import type { CertReadinessStatus }from '@/modules/analytics/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function scorePill(score: number) {
  const cls =
    score >= 75 ? 'bg-emerald-50 text-emerald-700' :
    score >= 50 ? 'bg-amber-50 text-amber-700'  :
                  'bg-red-50 text-red-600'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {score.toFixed(1)}%
    </span>
  )
}

const READINESS_LABELS: Record<CertReadinessStatus, string> = {
  ready:        'Ready',
  almost_ready: 'Almost Ready',
  not_ready:    'Not Ready',
}
const READINESS_COLORS: Record<CertReadinessStatus, string> = {
  ready:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  almost_ready: 'bg-amber-50  text-amber-700  border-amber-200',
  not_ready:    'bg-red-50    text-red-600    border-red-200',
}

// ── Additional academy-wide stats ─────────────────────────────────────────────

async function getAcademyStats(groupFilter: string[] | null) {
  const db = createServiceClient()

  // Attendance rate overall (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [attRes, certRes, assignRes] = await Promise.all([
    db.from('attendance_records')
      .select('status', { count: 'exact' })
      .gte('recorded_at', thirtyDaysAgo),
    db.from('certificates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    db.from('assignment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('grade', 'pass'),
  ])

  const attRows    = (attRes.data ?? []) as any[]
  const totalAtt   = attRes.count ?? 0
  const presentAtt = attRows.filter(r => r.status === 'present' || r.status === 'late').length
  const attRate    = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0

  return {
    overall_attendance_rate: attRate,
    total_certs_issued:      certRes.count ?? 0,
    total_passing_assignments: assignRes.count ?? 0,
    attendance_sample_size:  totalAtt,
  }
}

// ── Branch performance ────────────────────────────────────────────────────────

async function getBranchPerformance() {
  const db = createServiceClient()

  const { data: branches } = await db
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  if (!branches?.length) return []

  const bIds = branches.map((b: any) => b.id as string)

  // Student counts via active group memberships (groups are operational source of truth)
  const [activeGroupRows, groupCounts, certCounts] = await Promise.all([
    db.from('groups').select('id, branch_id').in('branch_id', bIds).eq('status', 'active').is('deleted_at', null),
    db.from('groups').select('branch_id').in('branch_id', bIds).eq('status', 'active').is('deleted_at', null),
    db.from('certificates').select('branch_id').in('branch_id', bIds).eq('status', 'active'),
  ])

  const sMap: Record<string, number> = {}
  const gMap: Record<string, number> = {}
  const cMap: Record<string, number> = {}

  // Count students per branch through active group memberships
  const activeGroupIds  = (activeGroupRows.data ?? []).map((g: any) => g.id as string)
  const groupBranchMap  = Object.fromEntries((activeGroupRows.data ?? []).map((g: any) => [g.id as string, g.branch_id as string]))
  if (activeGroupIds.length > 0) {
    const { data: stuRows } = await db.from('students').select('id').eq('status', 'active').is('deleted_at', null)
    const activeStudentSet = new Set((stuRows ?? []).map((s: any) => s.id as string))
    const { data: gsRows } = await db.from('group_students').select('student_id, group_id').in('group_id', activeGroupIds).eq('status', 'active')
    const branchStudentSets: Record<string, Set<string>> = {}
    for (const gs of (gsRows ?? []) as any[]) {
      if (!activeStudentSet.has(gs.student_id)) continue
      const bid = groupBranchMap[gs.group_id]
      if (!bid) continue
      if (!branchStudentSets[bid]) branchStudentSets[bid] = new Set()
      branchStudentSets[bid].add(gs.student_id)
    }
    for (const [bid, set] of Object.entries(branchStudentSets)) sMap[bid] = set.size
  }

  for (const r of groupCounts.data ?? [])   gMap[(r as any).branch_id] = (gMap[(r as any).branch_id] ?? 0) + 1
  for (const r of certCounts.data ?? [])    cMap[(r as any).branch_id] = (cMap[(r as any).branch_id] ?? 0) + 1

  return (branches as any[]).map(b => ({
    id:       b.id,
    name:     b.name,
    students: sMap[b.id] ?? 0,
    groups:   gMap[b.id] ?? 0,
    certs:    cMap[b.id] ?? 0,
  })).sort((a, b) => b.students - a.students)
}

// ── Operations analytics ──────────────────────────────────────────────────────

async function getOperationsData() {
  const db = createServiceClient()

  const [
    activeStudents, inactiveStudents, newStudentsMonth,
    activeGroups, emptyGroups, groupsNoInstructor, groupsNoCourse,
    activeCerts,
  ] = await Promise.all([
    db.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    db.from('students').select('id', { count: 'exact', head: true }).eq('status', 'inactive').is('deleted_at', null),
    db.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    db.from('groups').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    // Empty groups: active groups with 0 enrolled students
    db.from('groups').select('id').eq('status', 'active').is('deleted_at', null),
    db.from('group_instructors').select('group_id').limit(2000),
    db.from('group_courses').select('group_id').eq('status', 'active').limit(2000),
    db.from('certificates').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  // Empty groups count
  const allGroupIds: string[] = ((emptyGroups as any).data ?? []).map((g: any) => g.id as string)
  let emptyGroupCount = 0
  if (allGroupIds.length > 0) {
    const { data: gsRows } = await db.from('group_students').select('group_id').in('group_id', allGroupIds).eq('status', 'active')
    const withStudentsSet = new Set((gsRows ?? []).map((r: any) => r.group_id as string))
    emptyGroupCount = allGroupIds.filter(id => !withStudentsSet.has(id)).length
  }

  const withInstSet   = new Set(((groupsNoInstructor as any).data ?? []).map((r: any) => r.group_id as string))
  const withCourseSet = new Set(((groupsNoCourse as any).data ?? []).map((r: any) => r.group_id as string))
  const noInstructor  = allGroupIds.filter(id => !withInstSet.has(id)).length
  const noCourse      = allGroupIds.filter(id => !withCourseSet.has(id)).length

  return {
    activeStudents:   (activeStudents as any).count ?? 0,
    inactiveStudents: (inactiveStudents as any).count ?? 0,
    newStudentsMonth: (newStudentsMonth as any).count ?? 0,
    activeGroups:     (activeGroups as any).count ?? 0,
    emptyGroups:      emptyGroupCount,
    noInstructor,
    noCourse,
    activeCerts:      (activeCerts as any).count ?? 0,
  }
}

// ── Marketing analytics ───────────────────────────────────────────────────────

async function getMarketingData() {
  const db = createServiceClient()

  const { data: leads } = await db.from('leads').select('status, source, created_at, stage_entered_at, assigned_to')
  const rows = (leads ?? []) as any[]

  // By source
  const bySource: Record<string, number> = {}
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1

  // By status
  const converted = rows.filter(r => r.status === 'CONVERTED').length
  const lost      = rows.filter(r => r.status === 'LOST').length
  const active    = rows.filter(r => r.status !== 'CONVERTED' && r.status !== 'LOST').length
  const total     = rows.length
  const rate      = total > 0 ? Math.round((converted / total) * 100) : 0

  // Lost reasons
  const { data: lostRows } = await db.from('leads').select('lost_reason').eq('status', 'LOST').not('lost_reason', 'is', null)
  const lostReasons: Record<string, number> = {}
  for (const r of lostRows ?? []) {
    const reason = (r as any).lost_reason as string
    if (reason) lostReasons[reason] = (lostReasons[reason] ?? 0) + 1
  }

  // Avg days to convert
  const convertedRows = rows.filter(r => r.status === 'CONVERTED' && r.stage_entered_at && r.created_at)
  const avgDaysToConvert = convertedRows.length > 0
    ? Math.round(convertedRows.reduce((sum, r) => {
        return sum + (new Date(r.stage_entered_at).getTime() - new Date(r.created_at).getTime()) / 86400000
      }, 0) / convertedRows.length)
    : null

  return {
    total, converted, lost, active,
    conversionRate: rate,
    avgDaysToConvert,
    bySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 8),
    lostReasons: Object.entries(lostReasons).sort((a, b) => b[1] - a[1]).slice(0, 5),
  }
}

// ── Instructor analytics ──────────────────────────────────────────────────────

async function getInstructorData() {
  const db         = createServiceClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data: instructors } = await db
    .from('instructors')
    .select(`id, user_id, branch_id,
      users!instructors_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name)),
      branches!instructors_branch_id_fkey(name)`)
    .eq('status', 'active').is('deleted_at', null).limit(100)

  if (!instructors?.length) return []

  // Sessions this month per instructor (via group_courses)
  const instIds = (instructors as any[]).map(i => i.id as string)
  const { data: gcRows } = await db.from('group_courses').select('id, instructor_id').in('instructor_id', instIds).eq('status', 'active')
  const gcMap: Record<string, string[]> = {}
  for (const r of gcRows ?? []) {
    const iid = (r as any).instructor_id as string
    if (!gcMap[iid]) gcMap[iid] = []
    gcMap[iid].push((r as any).id as string)
  }

  const allGcIds = (gcRows ?? []).map((r: any) => r.id as string)
  const sessionMap: Record<string, number> = {}
  if (allGcIds.length > 0) {
    const { data: sched } = await db.from('schedules').select('group_course_id').in('group_course_id', allGcIds).gte('scheduled_at', monthStart).neq('status', 'cancelled')
    for (const s of sched ?? []) {
      const gcid = (s as any).group_course_id as string
      const iid  = (gcRows ?? []).find((r: any) => r.id === gcid)?.instructor_id as string | undefined
      if (iid) sessionMap[iid] = (sessionMap[iid] ?? 0) + 1
    }
  }

  return (instructors as any[]).map(i => {
    const prof = i.users?.profiles
    return {
      id:       i.id,
      name:     prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || i.users?.email : i.users?.email,
      branch:   i.branches?.name ?? '—',
      sessions: sessionMap[i.id] ?? 0,
    }
  }).sort((a, b) => b.sessions - a.sessions)
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    page?:      string
    miss_page?: string
    semester?:  string
    sort?:      string
    tab?:       string
  }>
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const user = await requireAuth()

  if (!['super_admin', 'team_leader'].includes(user.globalRole)) {
    redirect('/admin')
  }

  const params       = await searchParams
  const page         = Number(params.page ?? 1)
  const missPage     = Number(params.miss_page ?? 1)
  const semesterId   = params.semester
  const sort         = params.sort === 'attendance' ? 'attendance' : 'completion'
  const tab          = params.tab ?? 'overview'

  const groupFilter = await resolveGroupFilter(user)

  const [atRiskResult, certReadiness, missingResult, semesters, academyStats, branchPerf, groupPerf, coursePerf, opsData, marketingData, instructorData, financeKpis, branchFinance] = await Promise.all([
    listAtRiskStudents(groupFilter, { semesterId, sort, page, perPage: 15 }),
    listCertificateReadiness(groupFilter, { semesterId }),
    listMissingAssignments(groupFilter, { page: missPage, perPage: 15 }),
    listSemestersForAnalytics(),
    user.globalRole === 'super_admin' ? getAcademyStats(groupFilter) : Promise.resolve(null),
    user.globalRole === 'super_admin' ? getBranchPerformance() : Promise.resolve([]),
    listGroupPerformance(groupFilter),
    listCoursePerformance(groupFilter),
    user.globalRole === 'super_admin' ? getOperationsData() : Promise.resolve(null),
    user.globalRole === 'super_admin' ? getMarketingData()  : Promise.resolve(null),
    user.globalRole === 'super_admin' ? getInstructorData() : Promise.resolve([]),
    user.globalRole === 'super_admin' ? getFinanceKPIs()    : Promise.resolve(null),
    user.globalRole === 'super_admin' ? getBranchFinanceStats() : Promise.resolve([]),
  ])

  const certCounts = certReadiness.reduce(
    (acc, s) => { acc[s.status]++; return acc },
    { ready: 0, almost_ready: 0, not_ready: 0 } as Record<CertReadinessStatus, number>
  )

  function filterHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const base = { semester: semesterId, sort, tab, page: '1', miss_page: '1', ...overrides }
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v)
    return `/admin/analytics?${p.toString()}`
  }

  const tabs = [
    { id: 'overview',    label: 'Academic' },
    { id: 'at_risk',     label: `At-Risk (${atRiskResult.total})` },
    { id: 'certs',       label: 'Certificates' },
    { id: 'missing',     label: `Missing (${missingResult.total})` },
    { id: 'groups',      label: `Groups (${groupPerf.length})` },
    { id: 'courses',     label: `Courses (${coursePerf.length})` },
    ...(user.globalRole === 'super_admin' ? [
      { id: 'operations',  label: 'Operations' },
      { id: 'marketing',   label: 'Marketing' },
      { id: 'instructors', label: 'Instructors' },
      { id: 'branches',    label: 'Branches' },
      { id: 'finance',     label: 'Finance' },
      { id: 'revenue',     label: 'Revenue' },
    ] : []),
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Analytics</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Academic performance, certificate readiness, and operational insights
          </p>
        </div>

        {/* Semester filter */}
        {semesters.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#64748B]">Semester:</label>
            <div className="flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-white px-1">
              <Link
                href={filterHref({ semester: undefined })}
                className={`rounded px-2 py-1 text-xs ${!semesterId ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
              >
                All
              </Link>
              {semesters.slice(0, 5).map(s => (
                <Link
                  key={s.id}
                  href={filterHref({ semester: s.id })}
                  className={`rounded px-2 py-1 text-xs ${semesterId === s.id ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Academy stats (super_admin only) ───────────────────────────── */}
      {academyStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Attendance Rate (30d)', value: `${academyStats.overall_attendance_rate}%`, sub: `${academyStats.attendance_sample_size} records sampled`, color: academyStats.overall_attendance_rate >= 75 ? 'bg-emerald-400' : 'bg-amber-400' },
            { label: 'Certificates Issued',   value: academyStats.total_certs_issued,   color: 'bg-sky-400' },
            { label: 'At-Risk Students',      value: atRiskResult.total,                color: atRiskResult.total > 0 ? 'bg-red-400' : 'bg-emerald-400' },
            { label: 'Missing Assignments',   value: missingResult.total,               color: missingResult.total > 0 ? 'bg-amber-400' : 'bg-emerald-400' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className={`mb-2 h-1.5 w-7 rounded-full ${stat.color} opacity-80`} />
              <p className="text-2xl font-bold text-[#0B1F3A]">{stat.value}</p>
              <p className="mt-0.5 text-xs text-[#64748B]">{stat.label}</p>
              {(stat as any).sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{(stat as any).sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[#E2E8F0]">
        {tabs.map(t => (
          <Link
            key={t.id}
            href={filterHref({ tab: t.id })}
            className={[
              'px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px',
              tab === t.id
                ? 'border-[#FF8A1F] text-[#FF8A1F]'
                : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]',
            ].join(' ')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Tab: Overview (cert readiness) ─────────────────────────────── */}
      {(tab === 'overview' || tab === 'certs') && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Certificate Readiness</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['ready', 'almost_ready', 'not_ready'] as CertReadinessStatus[]).map(s => (
              <div key={s} className={`rounded-xl border p-4 ${READINESS_COLORS[s]}`}>
                <p className="text-2xl font-bold">{certCounts[s]}</p>
                <p className="mt-0.5 text-sm font-medium">{READINESS_LABELS[s]}</p>
              </div>
            ))}
          </div>

          {certReadiness.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Semester</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignments</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Overall</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {certReadiness.map(s => (
                    <tr key={`${s.student_id}::${s.semester_id}`} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#0B1F3A]">{s.student_name}</div>
                        <div className="text-[11px] text-[#94A3B8]">{s.student_email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B]">{s.semester_name}</td>
                      <td className="px-4 py-2.5">{scorePill(s.avg_attendance)}</td>
                      <td className="px-4 py-2.5">{scorePill(s.avg_assignment)}</td>
                      <td className="px-4 py-2.5">{scorePill(s.avg_completion)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${READINESS_COLORS[s.status]}`}>
                          {READINESS_LABELS[s.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {certReadiness.length === 0 && (
            <p className="text-sm text-[#94A3B8]">No progress data found for the selected filters.</p>
          )}
        </section>
      )}

      {/* ── Tab: At-Risk ───────────────────────────────────────────────── */}
      {tab === 'at_risk' && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#0B1F3A]">At-Risk Students</h2>
              <p className="text-xs text-[#94A3B8]">completion &lt; 70% or attendance &lt; 75% — {atRiskResult.total} found</p>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-white px-1">
              <Link href={filterHref({ sort: 'completion', page: '1' })} className={`rounded px-2 py-1 text-xs ${sort === 'completion' ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B]'}`}>Completion</Link>
              <Link href={filterHref({ sort: 'attendance', page: '1' })} className={`rounded px-2 py-1 text-xs ${sort === 'attendance' ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B]'}`}>Attendance</Link>
            </div>
          </div>

          {atRiskResult.data.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No at-risk students found.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Completion</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignment</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskResult.data.map(s => (
                    <tr key={`${s.student_id}-${s.course_id}`} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#0B1F3A]">{s.student_name}</div>
                        <div className="text-[11px] text-[#94A3B8]">{s.student_email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B]">{s.group_name}</td>
                      <td className="px-4 py-2.5 text-[#64748B]">{s.course_title}</td>
                      <td className="px-4 py-2.5">{scorePill(s.completion_percentage)}</td>
                      <td className="px-4 py-2.5">{scorePill(s.attendance_score)}</td>
                      <td className="px-4 py-2.5">{scorePill(s.assignment_score)}</td>
                      <td className="px-4 py-2.5">
                        {s.risk_reasons.map(r => (
                          <span key={r} className="mr-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                            {r === 'low_completion' ? 'Low Overall' : 'Low Attendance'}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={atRiskResult.page} totalPages={atRiskResult.totalPages} total={atRiskResult.total} perPage={atRiskResult.perPage} />
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Missing Assignments ────────────────────────────────────── */}
      {tab === 'missing' && (
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Missing Assignments</h2>
            <p className="text-xs text-[#94A3B8]">{missingResult.total} students with unsubmitted work</p>
          </div>

          {missingResult.data.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No missing assignments.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Missing</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {missingResult.data.map(s => (
                    <tr key={s.student_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#0B1F3A]">{s.student_name}</div>
                        <div className="text-[11px] text-[#94A3B8]">{s.student_email}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{s.missing_count}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {s.overdue_count > 0 ? (
                          <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{s.overdue_count} overdue</span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={missingResult.page} totalPages={missingResult.totalPages} total={missingResult.total} perPage={missingResult.perPage} />
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Branches ──────────────────────────────────────────────── */}
      {tab === 'branches' && user.globalRole === 'super_admin' && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Branch Performance</h2>
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Groups</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Certificates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Capacity</th>
                </tr>
              </thead>
              <tbody>
                {(branchPerf as any[]).map((b: any) => {
                  const maxStudents = Math.max(...(branchPerf as any[]).map((x: any) => x.students), 1)
                  const pct = Math.round((b.students / maxStudents) * 100)
                  return (
                    <tr key={b.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        <Link href={`/admin/branches/${b.id}`} className="hover:text-[#FF8A1F]">{b.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#0B1F3A]">{b.students}</td>
                      <td className="px-4 py-3 text-right text-[#64748B]">{b.groups}</td>
                      <td className="px-4 py-3 text-right text-[#64748B]">{b.certs}</td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="h-2 w-full rounded-full bg-[#F1F5F9]">
                          <div
                            className="h-2 rounded-full bg-[#FF8A1F] opacity-70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Tab: Group Performance ──────────────────────────────────────── */}
      {tab === 'groups' && (
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Group Performance</h2>
            <p className="text-xs text-[#94A3B8]">Sorted by overall completion — from student progress records</p>
          </div>
          {groupPerf.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No group progress data yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Students</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Completion</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignment</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {groupPerf.map(g => (
                    <tr key={g.group_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{g.group_name}</td>
                      <td className="px-4 py-2.5 text-[#64748B]">{g.branch_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-[#64748B]">{g.student_count}</td>
                      <td className="px-4 py-2.5">{scorePill(g.avg_completion)}</td>
                      <td className="px-4 py-2.5">{scorePill(g.avg_attendance)}</td>
                      <td className="px-4 py-2.5">{scorePill(g.avg_assignment)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/admin/groups/${g.group_id}`} className="text-xs text-[#FF8A1F] hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Course Performance ─────────────────────────────────────── */}
      {tab === 'courses' && (
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Course Performance</h2>
            <p className="text-xs text-[#94A3B8]">Average scores per course across all groups</p>
          </div>
          {coursePerf.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No course progress data yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Students</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Completion</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignment</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {coursePerf.map(c => (
                    <tr key={c.course_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{c.course_title}</td>
                      <td className="px-4 py-2.5 text-right text-[#64748B]">{c.student_count}</td>
                      <td className="px-4 py-2.5">{scorePill(c.avg_completion)}</td>
                      <td className="px-4 py-2.5">{scorePill(c.avg_attendance)}</td>
                      <td className="px-4 py-2.5">{scorePill(c.avg_assignment)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/admin/courses/${c.course_id}`} className="text-xs text-[#FF8A1F] hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Operations ──────────────────────────────────────────────── */}
      {tab === 'operations' && opsData && (
        <section className="space-y-5">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Operations Analytics</h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Active Students',   value: opsData.activeStudents,   color: 'bg-emerald-400' },
              { label: 'Inactive Students', value: opsData.inactiveStudents, color: 'bg-slate-300' },
              { label: 'New This Month',    value: opsData.newStudentsMonth, color: 'bg-teal-400' },
              { label: 'Active Groups',     value: opsData.activeGroups,     color: 'bg-blue-400' },
              { label: 'Empty Groups',      value: opsData.emptyGroups,      color: opsData.emptyGroups > 0 ? 'bg-amber-400' : 'bg-slate-300' },
              { label: 'No Instructor',     value: opsData.noInstructor,     color: opsData.noInstructor > 0 ? 'bg-red-400' : 'bg-slate-300' },
              { label: 'No Active Course',  value: opsData.noCourse,         color: opsData.noCourse > 0 ? 'bg-red-400' : 'bg-slate-300' },
              { label: 'Certificates',      value: opsData.activeCerts,      color: 'bg-sky-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className={`mb-2 h-1.5 w-7 rounded-full ${color} opacity-80`} />
                <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
              </div>
            ))}
          </div>

          {(opsData.noInstructor > 0 || opsData.noCourse > 0 || opsData.emptyGroups > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Operational issues detected.{' '}
              <Link href="/admin/system-health" className="font-semibold underline">View System Health →</Link>
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Marketing ───────────────────────────────────────────────── */}
      {tab === 'marketing' && marketingData && (
        <section className="space-y-5">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Marketing Analytics</h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Leads',      value: marketingData.total,          color: 'bg-violet-400' },
              { label: 'Active Leads',     value: marketingData.active,         color: 'bg-blue-400' },
              { label: 'Converted',        value: marketingData.converted,      color: 'bg-emerald-400' },
              { label: 'Conversion Rate',  value: `${marketingData.conversionRate}%`, color: marketingData.conversionRate >= 30 ? 'bg-emerald-400' : 'bg-amber-400' },
              { label: 'Lost',             value: marketingData.lost,           color: 'bg-red-400' },
              { label: 'Avg Days to Convert', value: marketingData.avgDaysToConvert !== null ? `${marketingData.avgDaysToConvert}d` : '—', color: 'bg-slate-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className={`mb-2 h-1.5 w-7 rounded-full ${color} opacity-80`} />
                <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
              </div>
            ))}
          </div>

          {marketingData.bySource.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Leads by Source</p>
              <div className="space-y-2">
                {marketingData.bySource.map(([source, count]) => {
                  const pct = marketingData.total > 0 ? Math.round((count / marketingData.total) * 100) : 0
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="w-32 text-xs capitalize text-[#64748B]">{source.replace(/_/g, ' ')}</span>
                      <div className="flex-1 rounded-full bg-[#F1F5F9] h-2">
                        <div className="h-2 rounded-full bg-[#FF8A1F] opacity-70" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs font-medium text-[#0B1F3A]">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {marketingData.lostReasons.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Top Lost Reasons</p>
              <div className="space-y-1.5">
                {marketingData.lostReasons.map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs">
                    <span className="text-[#64748B]">{reason}</span>
                    <span className="font-semibold text-red-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Instructors ─────────────────────────────────────────────── */}
      {tab === 'instructors' && (
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Instructor Analytics</h2>
            <p className="text-xs text-[#94A3B8]">Ranked by sessions delivered this month</p>
          </div>

          {(instructorData as any[]).length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No active instructors found.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Sessions (Month)</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {(instructorData as any[]).map((i: any, idx: number) => (
                    <tr key={i.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 text-xs font-medium text-[#94A3B8]">#{idx + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{i.name}</td>
                      <td className="px-4 py-2.5 text-[#64748B]">{i.branch}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-bold ${i.sessions > 0 ? 'text-[#0B1F3A]' : 'text-[#94A3B8]'}`}>{i.sessions}</span>
                        {i.sessions === 0 && <span className="ml-1 text-[10px] text-amber-500">No sessions</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/admin/instructors/${i.id}`} className="text-xs text-[#FF8A1F] hover:underline">Profile</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Finance ─────────────────────────────────────────────── */}
      {tab === 'finance' && user.globalRole === 'super_admin' && financeKpis && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Finance & Collections Analytics</h2>
            <Link href="/admin/finance" className="text-xs font-medium text-[#FF8A1F] hover:underline">
              Open Finance Center →
            </Link>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Expected This Month',  value: `EGP ${new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(financeKpis.expected_this_month)}`,  color: 'bg-violet-400' },
              { label: 'Collected This Month', value: `EGP ${new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(financeKpis.collected_this_month)}`, color: 'bg-emerald-400' },
              { label: 'Outstanding',          value: `EGP ${new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(financeKpis.outstanding_total)}`,    color: financeKpis.outstanding_total > 0 ? 'bg-amber-400' : 'bg-emerald-400' },
              { label: 'Collection Rate',      value: `${financeKpis.collection_rate_pct}%`,  color: financeKpis.collection_rate_pct >= 80 ? 'bg-emerald-400' : financeKpis.collection_rate_pct >= 50 ? 'bg-amber-400' : 'bg-red-400' },
              { label: 'Overdue Students',     value: financeKpis.overdue_count,              color: financeKpis.overdue_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
              { label: 'Due This Week',        value: financeKpis.due_this_week,              color: financeKpis.due_this_week > 0 ? 'bg-amber-400' : 'bg-slate-300' },
              { label: 'Students Paid',        value: financeKpis.paid_students,              color: 'bg-teal-400' },
              { label: 'Total Accounts',       value: financeKpis.total_students,             color: 'bg-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className={`mb-2 h-1.5 w-7 rounded-full ${color} opacity-80`} />
                <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
              </div>
            ))}
          </div>

          {/* Branch finance performance */}
          {(branchFinance as any[]).length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Branch Finance Performance</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Net Total</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Collected</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Outstanding</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Collection Rate</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {(branchFinance as any[]).map((b: any) => (
                    <tr key={b.branch_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                        <Link href={`/admin/branches/${b.branch_id}`} className="hover:text-[#FF8A1F]">
                          {b.branch_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#64748B]">
                        EGP {new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(b.net_amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                        EGP {new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(b.paid_amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-red-500">
                        EGP {new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(b.outstanding)}
                      </td>
                      <td className="px-4 py-2.5 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${b.collection_rate >= 80 ? 'bg-emerald-400' : b.collection_rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${b.collection_rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[#0B1F3A] w-9 text-right">{b.collection_rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {b.overdue_count > 0 ? (
                          <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                            {b.overdue_count}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(branchFinance as any[]).length === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No financial accounts created yet. Go to Finance Center to add student accounts.</p>
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Revenue (Placeholder) ────────────────────────────────── */}
      {tab === 'revenue' && (
        <section className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Revenue Intelligence</h2>
            <p className="text-xs text-[#94A3B8]">Payment processing is not active. This section shows enrollment-based estimates.</p>
          </div>

          {/* Enrollment-based metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Active Students (enrolled)', value: opsData?.activeStudents ?? '—', note: 'Potential paying students' },
              { label: 'New Students (month)',        value: opsData?.newStudentsMonth ?? '—', note: 'New enrollments' },
              { label: 'Active Groups',               value: opsData?.activeGroups ?? '—', note: 'Revenue-generating groups' },
            ].map(({ label, value, note }) => (
              <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
                <p className="mt-1 text-[11px] text-[#94A3B8]">{note}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-800">Revenue Tracking Coming Soon</p>
            <p className="mt-1 text-xs text-blue-600">
              The financial module (invoices, payments, subscriptions) is in the database schema
              but not yet connected to this dashboard. When payment processing is activated, this
              section will show: revenue by branch, by course, by student, monthly trends, and
              outstanding balances.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {['Revenue by Branch', 'Revenue by Course', 'Monthly Trend', 'Outstanding Balances', 'Paid vs Unpaid', 'Per-Student Revenue'].map(m => (
                <div key={m} className="rounded-lg bg-white/60 px-3 py-2 text-xs font-medium text-blue-700 opacity-60">
                  {m}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
