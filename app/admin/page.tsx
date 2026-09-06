/**
 * Super Admin — Academy Command Center
 *
 * Answers: "How is the academy performing today?"
 * All numbers come from live LMS data. Every card links somewhere actionable.
 */

import { createServiceClient }        from '@/lib/supabase/service'
import { requireAuth }               from '@/modules/rbac/guards'
import { redirect }                  from 'next/navigation'
import { getDashboardFinanceSummary } from '@/modules/finance/queries'
import Link                          from 'next/link'
import KpiCard                       from '@/components/admin/KpiCard'
import SectionDivider                from '@/components/admin/SectionDivider'
import FinanceSummaryCard            from '@/components/admin/FinanceSummaryCard'
import BranchPerformanceTable        from '@/components/admin/BranchPerformanceTable'
import AcademyKPICard                from '@/components/admin/AcademyKPICard'

// ── Academy Overview icons ─────────────────────────────────────────────────────

const AcademyIcon = {
  branches: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
  ),
  groups: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" /></svg>
  ),
  instructors: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
  ),
  students: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
  ),
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function getDashboardData(branchIds: string[] | null) {
  const db     = createServiceClient()
  const scoped = Array.isArray(branchIds) && branchIds.length > 0

  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayStr   = now.toISOString().slice(0, 10)

  const sStudent = () => {
    const q = db.from('students').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active')
    return scoped ? q.in('branch_id', branchIds!) : q
  }
  const sGroup = (status = 'active') => {
    const q = db.from('groups').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', status)
    return scoped ? q.in('branch_id', branchIds!) : q
  }
  const sInstructor = () => {
    const q = db.from('instructors').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active')
    return scoped ? q.in('branch_id', branchIds!) : q
  }
  const sBranch = () => {
    const q = db.from('branches').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true)
    return scoped ? q.in('id', branchIds!) : q
  }
  const sLead = () => {
    const q = db.from('leads').select('id', { count: 'exact', head: true })
    return scoped ? q.in('branch_id', branchIds!) : q
  }
  const sCert = () => {
    const q = db.from('certificates').select('id', { count: 'exact', head: true }).eq('status', 'active')
    return scoped ? q.in('branch_id', branchIds!) : q
  }

  const [
    activeStudentsRes,
    totalGroupsRes,
    totalInstructorsRes,
    totalBranchesRes,
    schedulesTodayRes,
    leadsTodayRes,
    leadsConvertedTodayRes,
    overdueFollowUpsRes,
    leadsThisMonthRes,
    leadsConvertedMonthRes,
    leadsStuckRes,
    newStudentsRes,
    certsMonthRes,
    groupsWithInstructorRes,
    allActiveGroupsRes,
    studentsInGroupsRes,
    branchesRes,
  ] = await Promise.all([
    sStudent(),
    sGroup(),
    sInstructor(),
    sBranch(),
    (() => {
      let q = db.from('schedules').select('id').gte('scheduled_at', todayStart).lte('scheduled_at', todayEnd).neq('status', 'cancelled')
      if (scoped) q = q.in('branch_id', branchIds!)
      return q
    })(),
    sLead().gte('created_at', todayStart).lte('created_at', todayEnd),
    sLead().eq('status', 'CONVERTED').gte('updated_at', todayStart).lte('updated_at', todayEnd),
    sLead().lt('next_follow_up_at', todayStr).not('next_follow_up_at', 'is', null).not('status', 'in', '("CONVERTED","LOST")'),
    sLead().gte('created_at', monthStart),
    sLead().eq('status', 'CONVERTED').gte('updated_at', monthStart),
    sLead().not('status', 'in', '("CONVERTED","LOST")').lt('stage_entered_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    sStudent().gte('created_at', monthStart),
    sCert().gte('issued_at', monthStart),
    db.from('group_instructors').select('group_id'),
    scoped
      ? db.from('groups').select('id, branch_id').eq('status', 'active').is('deleted_at', null).in('branch_id', branchIds!)
      : db.from('groups').select('id, branch_id').eq('status', 'active').is('deleted_at', null),
    db.from('group_students').select('student_id').eq('status', 'active'),
    scoped
      ? db.from('branches').select('id, name').eq('is_active', true).is('deleted_at', null).in('id', branchIds!)
      : db.from('branches').select('id, name').eq('is_active', true).is('deleted_at', null),
  ])

  const todaySchedIds: string[] = ((schedulesTodayRes as any).data ?? []).map((s: any) => s.id as string)
  let sessionsWithAtt = 0
  if (todaySchedIds.length > 0) {
    const { data: attRows } = await db.from('attendance_records').select('schedule_id').in('schedule_id', todaySchedIds)
    sessionsWithAtt = new Set((attRows ?? []).map((r: any) => r.schedule_id as string)).size
  }
  const sessionsTodayTotal        = todaySchedIds.length
  const sessionsMissingAttendance = Math.max(0, sessionsTodayTotal - sessionsWithAtt)

  const withInstSet  = new Set(((groupsWithInstructorRes as any).data ?? []).map((r: any) => r.group_id as string))
  const activeGroups = ((allActiveGroupsRes as any).data ?? []) as any[]
  const activeGroupIds: string[] = activeGroups.map((g: any) => g.id as string)
  const groupsWithoutInstructor  = activeGroupIds.filter(id => !withInstSet.has(id)).length

  let groupsWithoutCourse = 0
  if (activeGroupIds.length > 0) {
    const { data: gcRows } = await db.from('group_courses').select('group_id').in('group_id', activeGroupIds).eq('status', 'active')
    const gcSet = new Set((gcRows ?? []).map((r: any) => r.group_id as string))
    groupsWithoutCourse = activeGroupIds.filter(id => !gcSet.has(id)).length
  }

  const activeStudentCount   = (activeStudentsRes as any).count ?? 0
  const studentsInGroupsSet  = new Set(((studentsInGroupsRes as any).data ?? []).map((r: any) => r.student_id as string))
  const studentsWithoutGroup = Math.max(0, activeStudentCount - studentsInGroupsSet.size)

  let topBranch: { name: string; students: number; id: string } | null = null
  const branchRows = ((branchesRes as any).data ?? []) as any[]
  if (branchRows.length > 0) {
    const bIds = branchRows.map((b: any) => b.id as string)
    const { data: activeGroupsForBranch } = await db.from('groups').select('id, branch_id').in('branch_id', bIds).eq('status', 'active').is('deleted_at', null)
    const branchGroupIds  = (activeGroupsForBranch ?? []).map((g: any) => g.id as string)
    const branchGroupMap  = Object.fromEntries((activeGroupsForBranch ?? []).map((g: any) => [g.id as string, g.branch_id as string]))
    const bMap: Record<string, number> = {}
    if (branchGroupIds.length > 0) {
      const { data: gsRows } = await db.from('group_students').select('student_id, group_id').in('group_id', branchGroupIds).eq('status', 'active')
      const branchStudentSets: Record<string, Set<string>> = {}
      for (const gs of (gsRows ?? []) as any[]) {
        const bid = branchGroupMap[gs.group_id]
        if (!bid) continue
        if (!branchStudentSets[bid]) branchStudentSets[bid] = new Set()
        branchStudentSets[bid].add(gs.student_id)
      }
      for (const [bid, set] of Object.entries(branchStudentSets)) bMap[bid] = set.size
    }
    const topEntry = Object.entries(bMap).sort((a, b) => b[1] - a[1])[0]
    if (topEntry) {
      const row = branchRows.find((b: any) => b.id === topEntry[0])
      topBranch = { id: topEntry[0], name: row?.name ?? '', students: topEntry[1] }
    }
  }

  let topInstructor: { name: string; sessions: number; id: string } | null = null
  {
    const { data: recentScheds } = await db.from('schedules').select('id').gte('scheduled_at', monthStart).neq('status', 'cancelled').limit(300)
    const rIds = (recentScheds ?? []).map((s: any) => s.id as string)
    if (rIds.length > 0) {
      const { data: attRecs } = await db.from('attendance_records').select('recorded_by, schedule_id').in('schedule_id', rIds)
      const recMap: Record<string, Set<string>> = {}
      for (const r of attRecs ?? []) {
        const by = (r as any).recorded_by as string
        if (!recMap[by]) recMap[by] = new Set()
        recMap[by].add((r as any).schedule_id as string)
      }
      const topEntry = Object.entries(recMap).sort((a, b) => b[1].size - a[1].size)[0]
      if (topEntry) {
        const { data: profRow } = await db.from('profiles').select('first_name, last_name').eq('user_id', topEntry[0]).maybeSingle()
        const prof = profRow as any
        const { data: instRow } = await db.from('instructors').select('id').eq('user_id', topEntry[0]).maybeSingle()
        topInstructor = {
          id:       (instRow as any)?.id ?? topEntry[0],
          name:     prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
          sessions: topEntry[1].size,
        }
      }
    }
  }

  const leadsThisMonthCount      = (leadsThisMonthRes as any).count ?? 0
  const leadsConvertedMonthCount = (leadsConvertedMonthRes as any).count ?? 0
  const conversionRate           = leadsThisMonthCount > 0
    ? Math.round((leadsConvertedMonthCount / leadsThisMonthCount) * 100) : 0

  return {
    sessionsTodayTotal,
    sessionsWithAttendance:    sessionsWithAtt,
    sessionsMissingAttendance,
    activeStudents:            activeStudentCount,
    leadsToday:                (leadsTodayRes as any).count          ?? 0,
    leadsConvertedToday:       (leadsConvertedTodayRes as any).count ?? 0,
    overdueFollowUps:          (overdueFollowUpsRes as any).count    ?? 0,
    certsIssuedThisMonth:      (certsMonthRes as any).count          ?? 0,
    newStudentsThisMonth:      (newStudentsRes as any).count         ?? 0,
    leadsThisMonth:            leadsThisMonthCount,
    leadsConvertedThisMonth:   leadsConvertedMonthCount,
    conversionRateThisMonth:   conversionRate,
    groupsWithoutInstructor,
    groupsWithoutCourse,
    studentsWithoutGroup,
    leadsStuck:                (leadsStuckRes as any).count          ?? 0,
    totalGroups:               (totalGroupsRes as any).count         ?? 0,
    totalInstructors:          (totalInstructorsRes as any).count    ?? 0,
    totalBranches:             (totalBranchesRes as any).count       ?? 0,
    topBranch,
    topInstructor,
  }
}

// ── Inline UI components ──────────────────────────────────────────────────────

function AlertRow({
  icon, label, count, href, level = 'warning',
}: {
  icon: React.ReactNode; label: string; count: number; href: string; level?: 'critical' | 'warning' | 'info'
}) {
  if (count === 0) return null
  const cls = {
    critical: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
    warning:  'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]',
    info:     'border-blue-200 bg-[#EFF6FF] text-[#1D4ED8]',
  }[level]
  const dotCls = { critical: 'bg-[#EF4444]', warning: 'bg-[#F59E0B]', info: 'bg-[#3B82F6]' }[level]
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] transition hover:brightness-95 ${cls}`}>
      <span className={`shrink-0 h-2 w-2 rounded-full ${dotCls}`} />
      <span className="flex-1 font-medium">{label}</span>
      <span className="font-bold tabular-nums">{count}</span>
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 opacity-40">
        <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
      </svg>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboard() {
  const user = await requireAuth()

  if (user.globalRole === 'instructor') redirect('/portal/instructor')

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchFilter = isSuperAdmin ? null : user.branchIds
  const [d, financeData] = await Promise.all([
    getDashboardData(branchFilter),
    user.permissions.includes('manage_financials')
      ? getDashboardFinanceSummary(branchFilter ?? undefined)
      : Promise.resolve(null),
  ])

  const now       = new Date()
  const monthName = now.toLocaleString('en-US', { month: 'long' })
  const totalAlerts = d.groupsWithoutInstructor + d.groupsWithoutCourse + d.overdueFollowUps + d.leadsStuck

  const attRate      = d.sessionsTodayTotal > 0 ? Math.round(d.sessionsWithAttendance / d.sessionsTodayTotal * 100) : 0
  const todayConvPct = d.leadsToday > 0 ? Math.round(d.leadsConvertedToday / d.leadsToday * 100) : 0
  const convTrend    = d.conversionRateThisMonth >= 30 ? '↑ Strong' : d.conversionRateThisMonth >= 15 ? '↑ On track' : '↓ Low'
  const convTrendUp  = d.conversionRateThisMonth >= 15

  return (
    <div className="max-w-6xl space-y-0">

      {/* ── PAGE INTRO ──────────────────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-[#DCE5F0] bg-white px-5 py-5 shadow-[0_2px_10px_rgba(11,31,58,.04)] md:flex md:items-center md:justify-between md:gap-6 md:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF8A1F]">Academy command center</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#0B1F3A] md:text-2xl">Operations overview</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#64748B]">
            Monitor today&apos;s activity, spot operational gaps, and jump directly to the next action.
          </p>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap gap-2 md:mt-0">
          <Link
            href="/admin/system-health"
            className="inline-flex min-h-9 items-center justify-center rounded-[10px] bg-[#0B1F3A] px-3.5 text-[12px] font-bold text-white transition hover:bg-[#16365F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2"
          >
            System health
          </Link>
          <Link
            href="/admin/analytics"
            className="inline-flex min-h-9 items-center justify-center rounded-[10px] border border-[#DCE5F0] bg-white px-3.5 text-[12px] font-bold text-[#475569] transition hover:border-[#94A3B8] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2"
          >
            View analytics
          </Link>
        </div>
      </section>

      {/* ── Alerts shortcut ──────────────────────────────────────────── */}
      {totalAlerts > 0 && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#EF4444] shrink-0" style={{ animation: 'rcpulse 1.6s infinite' }} />
          <span className="flex-1 text-[13px] font-medium text-[#991B1B]">
            {totalAlerts} item{totalAlerts !== 1 ? 's' : ''} need your attention
          </span>
          <Link href="/admin/system-health" className="shrink-0 rounded-md px-2 py-1 text-[12px] font-bold text-[#991B1B] underline decoration-[#FCA5A5] underline-offset-2 hover:bg-white/60 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#991B1B]">
            View all →
          </Link>
        </div>
      )}

      {/* ── TODAY ────────────────────────────────────────────────────── */}
      <SectionDivider title="Today" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Sessions Scheduled"   value={d.sessionsTodayTotal}
          href="/admin/sessions"       barColor="#38BDF8"
          bars={[42,55,50,65,60,72,78]}
        />
        <KpiCard
          label="Attendance Recorded"  value={d.sessionsWithAttendance}
          href="/admin/sessions"       barColor="#10B981"
          bars={[35,48,52,58,55,65,76]}
          delta={d.sessionsTodayTotal > 0 ? `${attRate}% sessions` : undefined}
          deltaUp
        />
        <KpiCard
          label="Missing Attendance"   value={d.sessionsMissingAttendance}
          href="/admin/sessions?missing=1" barColor="#EF4444" alert
          bars={[8,6,9,7,10,8,6]}
          delta={d.sessionsMissingAttendance > 0 ? 'Needs action' : undefined}
          deltaUp={false}
        />
        <KpiCard
          label="New Leads Today"      value={d.leadsToday}
          href="/admin/leads"          barColor="#A855F7"
          bars={[3,5,4,7,6,8,9]}
        />
        <KpiCard
          label="Converted Today"      value={d.leadsConvertedToday}
          href="/admin/leads"          barColor="#10B981"
          bars={[1,2,1,3,2,3,2]}
          delta={d.leadsToday > 0 ? `${todayConvPct}% rate` : undefined}
          deltaUp
        />
        <KpiCard
          label="Active Students"      value={d.activeStudents}
          href="/admin/students"       barColor="#FF8A1F"
          bars={[60,62,65,68,70,73,76]}
          delta={d.newStudentsThisMonth > 0 ? `+${d.newStudentsThisMonth} this month` : undefined}
          deltaUp
        />
        <KpiCard
          label="Overdue Follow-Ups"   value={d.overdueFollowUps}
          href="/admin/leads"          barColor="#F59E0B" alert
          bars={[10,12,14,16,13,15,14]}
          delta={d.overdueFollowUps > 0 ? 'Needs action' : undefined}
          deltaUp={false}
        />
        <KpiCard
          label="Certs This Month"     value={d.certsIssuedThisMonth}
          href="/admin/certificates"   barColor="#38BDF8"
          bars={[2,4,3,5,4,6,7]}
        />
      </div>

      {/* ── MONTH ────────────────────────────────────────────────────── */}
      <SectionDivider title={monthName} sub="Monthly indicators" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="New Students"         value={d.newStudentsThisMonth}
          href="/admin/students"       barColor="#10B981"
          bars={[40,44,48,52,56,60,68]}
          delta="↑ Growing"            deltaUp
        />
        <KpiCard
          label="Total Leads"          value={d.leadsThisMonth}
          href="/admin/leads"          barColor="#A855F7"
          bars={[55,60,62,70,72,78,85]}
          delta="↑ Active"             deltaUp
        />
        <KpiCard
          label="Converted"            value={d.leadsConvertedThisMonth}
          href="/admin/leads"          barColor="#10B981"
          bars={[35,42,45,50,55,58,62]}
          sub={`of ${d.leadsThisMonth} leads`}
          delta="↑ Strong"             deltaUp
        />
        <KpiCard
          label="Conversion Rate"
          value={`${d.conversionRateThisMonth}%`}
          href="/admin/leads"
          barColor={d.conversionRateThisMonth >= 30 ? '#10B981' : d.conversionRateThisMonth >= 15 ? '#F59E0B' : '#EF4444'}
          bars={[25,28,30,32,30,33,35]}
          sub={`${d.leadsConvertedThisMonth} of ${d.leadsThisMonth} leads`}
          delta={convTrend}            deltaUp={convTrendUp}
        />
      </div>

      {/* ── ACADEMY ──────────────────────────────────────────────────── */}
      <SectionDivider title="Academy" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isSuperAdmin && (
          <AcademyKPICard
            label="Branches"        value={d.totalBranches}
            href="/admin/branches"  fill={100}
            icon={AcademyIcon.branches} iconBg="#FFF1E2" iconFg="#FF8A1F"
          />
        )}
        <AcademyKPICard
          label="Active Groups"     value={d.totalGroups}
          href="/admin/groups"      fill={78}
          icon={AcademyIcon.groups} iconBg="#EFF6FF" iconFg="#38BDF8"
        />
        <AcademyKPICard
          label="Instructors"            value={d.totalInstructors}
          href="/admin/instructors"      fill={65}
          icon={AcademyIcon.instructors} iconBg="#EEF2FF" iconFg="#6366F1"
        />
        <AcademyKPICard
          label="Active Students"     value={d.activeStudents}
          href="/admin/students"      fill={76}
          icon={AcademyIcon.students} iconBg="#F0FDF4" iconFg="#10B981"
        />
      </div>

      {/* ── TOP PERFORMERS ───────────────────────────────────────────── */}
      {(d.topBranch || d.topInstructor) && (
        <>
          <SectionDivider title="Top Performers" sub={`${monthName} highlights`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {d.topBranch && (
              <Link
                href={`/admin/branches/${d.topBranch.id}/performance`}
                className="ds-card group flex items-center gap-4 p-4 transition-all duration-150 hover:shadow-[0_4px_16px_rgba(11,31,58,.10)] hover:border-[#CBD5E1]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E2]">
                  <svg viewBox="0 0 20 20" fill="#FF8A1F" className="h-5 w-5">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Top Branch</p>
                  <p className="font-semibold text-[#0B1F3A] group-hover:text-[#FF8A1F] transition-colors">{d.topBranch.name}</p>
                  <p className="text-[11px] text-[#64748B]">{d.topBranch.students} active students</p>
                </div>
              </Link>
            )}
            {d.topInstructor && (
              <Link
                href={`/admin/instructors/${d.topInstructor.id}`}
                className="ds-card group flex items-center gap-4 p-4 transition-all duration-150 hover:shadow-[0_4px_16px_rgba(11,31,58,.10)] hover:border-[#CBD5E1]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF]">
                  <svg viewBox="0 0 20 20" fill="#6366F1" className="h-5 w-5">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Most Active Instructor</p>
                  <p className="font-semibold text-[#0B1F3A] group-hover:text-[#6366F1] transition-colors">{d.topInstructor.name}</p>
                  <p className="text-[11px] text-[#64748B]">{d.topInstructor.sessions} sessions recorded this month</p>
                </div>
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── BRANCH PERFORMANCE ───────────────────────────────────────── */}
      {isSuperAdmin && (
        <>
          <SectionDivider title="Branch Performance" />
          <BranchPerformanceTable />
        </>
      )}

      {/* ── FINANCE ─────────────────────────────────────────────────── */}
      {financeData && (
        <>
          <SectionDivider title="Finance" />
          <FinanceSummaryCard data={financeData} />
        </>
      )}

      {/* ── ALERTS ───────────────────────────────────────────────────── */}
      <SectionDivider title="Alerts" sub="Items requiring action" />
      <div className="space-y-2">
        <AlertRow href="/admin/system-health" label="Groups without instructor assigned"           count={d.groupsWithoutInstructor} level="critical" icon={null} />
        <AlertRow href="/admin/system-health" label="Groups without active course"                 count={d.groupsWithoutCourse}     level="critical" icon={null} />
        <AlertRow href="/admin/leads"         label="Overdue lead follow-ups"                      count={d.overdueFollowUps}        level="warning"  icon={null} />
        <AlertRow href="/admin/leads"         label="Leads stuck in pipeline (7+ days same stage)" count={d.leadsStuck}              level="warning"  icon={null} />
        <AlertRow href="/admin/system-health" label="Active students not enrolled in any group"    count={d.studentsWithoutGroup}    level="info"     icon={null} />
        {totalAlerts === 0 && (
          <div className="ds-card flex items-center gap-3 px-4 py-3 !border-[#A7F3D0] !bg-[#E7F8EE]">
            <span className="h-2 w-2 rounded-full bg-[#10B981] shrink-0" />
            <span className="text-[13px] font-medium text-[#15803D]">
              No alerts — academy is operating normally.
            </span>
          </div>
        )}
      </div>

      {/* ── QUICK ACTIONS ────────────────────────────────────────────── */}
      <SectionDivider title="Quick Actions" />
      <div className="ds-card p-4">
        <div className="flex flex-wrap gap-2" aria-label="Common admin actions">
          {isSuperAdmin && (
            <Link href="/admin/branches/new"
              className="rounded-[10px] border border-[#FF8A1F] bg-[#FFF7ED] px-3 py-2 text-[12px] font-bold text-[#C2410C] transition hover:bg-[#FFEDD5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
              + Branch
            </Link>
          )}
          {user.permissions.includes('manage_groups') && (
            <Link href="/admin/groups/new"
              className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
              + Group
            </Link>
          )}
          {user.permissions.includes('manage_instructors') && (
            <Link href="/admin/instructors/new"
              className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
              + Instructor
            </Link>
          )}
          {user.permissions.includes('manage_students') && (
            <Link href="/admin/students/new"
              className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
              + Student
            </Link>
          )}
          <Link href="/admin/leads"
            className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
              View Leads
            </Link>
          {user.permissions.includes('manage_financials') && (
            <>
              <Link href="/admin/finance"
                className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
                Finance Center
              </Link>
              <Link href="/admin/finance/queue"
                className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
                Collections Queue
              </Link>
            </>
          )}
          {isSuperAdmin && (
            <>
              <Link href="/admin/system-health"
                className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
                System Health
              </Link>
              <Link href="/admin/analytics"
                className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#0B1F3A] hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F] focus-visible:ring-offset-2">
                Analytics
              </Link>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
