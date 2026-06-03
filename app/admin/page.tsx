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
    // Schedules today
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

  // Sessions with/without attendance today
  const todaySchedIds: string[] = ((schedulesTodayRes as any).data ?? []).map((s: any) => s.id as string)
  let sessionsWithAtt = 0
  if (todaySchedIds.length > 0) {
    const { data: attRows } = await db.from('attendance_records').select('schedule_id').in('schedule_id', todaySchedIds)
    sessionsWithAtt = new Set((attRows ?? []).map((r: any) => r.schedule_id as string)).size
  }
  const sessionsTodayTotal        = todaySchedIds.length
  const sessionsMissingAttendance = Math.max(0, sessionsTodayTotal - sessionsWithAtt)

  // Groups without instructor / course
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

  // Students without group
  const activeStudentCount   = (activeStudentsRes as any).count ?? 0
  const studentsInGroupsSet  = new Set(((studentsInGroupsRes as any).data ?? []).map((r: any) => r.student_id as string))
  const studentsWithoutGroup = Math.max(0, activeStudentCount - studentsInGroupsSet.size)

  // Top branch by student count
  let topBranch: { name: string; students: number; id: string } | null = null
  const branchRows = ((branchesRes as any).data ?? []) as any[]
  if (branchRows.length > 0) {
    const bIds = branchRows.map((b: any) => b.id as string)
    const { data: bStudents } = await db.from('students').select('branch_id').in('branch_id', bIds).eq('status', 'active').is('deleted_at', null)
    const bMap: Record<string, number> = {}
    for (const s of bStudents ?? []) bMap[(s as any).branch_id] = (bMap[(s as any).branch_id] ?? 0) + 1
    const topEntry = Object.entries(bMap).sort((a, b) => b[1] - a[1])[0]
    if (topEntry) {
      const row = branchRows.find((b: any) => b.id === topEntry[0])
      topBranch = { id: topEntry[0], name: row?.name ?? '', students: topEntry[1] }
    }
  }

  // Top instructor by sessions this month
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
        // Resolve instructor record id
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
    // TODAY
    sessionsTodayTotal,
    sessionsWithAttendance:    sessionsWithAtt,
    sessionsMissingAttendance,
    activeStudents:            activeStudentCount,
    leadsToday:                (leadsTodayRes as any).count          ?? 0,
    leadsConvertedToday:       (leadsConvertedTodayRes as any).count ?? 0,
    overdueFollowUps:          (overdueFollowUpsRes as any).count    ?? 0,
    certsIssuedThisMonth:      (certsMonthRes as any).count          ?? 0,
    // THIS MONTH
    newStudentsThisMonth:      (newStudentsRes as any).count         ?? 0,
    leadsThisMonth:            leadsThisMonthCount,
    leadsConvertedThisMonth:   leadsConvertedMonthCount,
    conversionRateThisMonth:   conversionRate,
    // ALERTS
    groupsWithoutInstructor,
    groupsWithoutCourse,
    studentsWithoutGroup,
    leadsStuck:                (leadsStuckRes as any).count          ?? 0,
    // TOTALS
    totalGroups:               (totalGroupsRes as any).count         ?? 0,
    totalInstructors:          (totalInstructorsRes as any).count    ?? 0,
    totalBranches:             (totalBranchesRes as any).count       ?? 0,
    // TOP
    topBranch,
    topInstructor,
  }
}

// ── UI components ─────────────────────────────────────────────────────────────

function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">{title}</p>
      {sub && <p className="mt-0.5 text-xs text-[#CBD5E1]">{sub}</p>}
    </div>
  )
}

function Card({
  label, value, sub, href, color = 'bg-slate-300', alert = false,
}: {
  label: string; value: number | string; sub?: string; href?: string; color?: string; alert?: boolean
}) {
  const content = (
    <div className={[
      'rounded-xl border bg-white p-4 transition',
      href ? 'hover:shadow-sm hover:border-[#CBD5E1]' : '',
      alert && value !== 0 ? 'border-red-200 bg-red-50' : 'border-[#E2E8F0]',
    ].join(' ')}>
      <div className={`mb-2.5 h-1.5 w-8 rounded-full ${color} opacity-80`} />
      <p className={`text-2xl font-bold ${alert && value !== 0 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-[#64748B]">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function Alert({
  icon, label, count, href, level = 'warning',
}: {
  icon: React.ReactNode; label: string; count: number; href: string; level?: 'critical' | 'warning' | 'info'
}) {
  if (count === 0) return null
  const cls = {
    critical: 'border-red-200 bg-red-50 text-red-700',
    warning:  'border-amber-200 bg-amber-50 text-amber-700',
    info:     'border-blue-200 bg-blue-50 text-blue-700',
  }[level]
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:brightness-95 ${cls}`}>
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      <span className="font-bold">{count}</span>
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 opacity-50">
        <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
      </svg>
    </Link>
  )
}

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

const IcoAlert     = <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
const IcoClock     = <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
const IcoBook      = <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
const IcoStudent   = <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" /></svg>

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

  return (
    <div className="max-w-300 space-y-0">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Academy Overview</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {totalAlerts > 0 && (
          <Link href="/admin/system-health" className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
          </Link>
        )}
      </div>

      {/* ── TODAY ────────────────────────────────────────────────────────── */}
      <Section title="Today" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <Card label="Sessions Scheduled"   value={d.sessionsTodayTotal}       href="/admin/sessions"     color="bg-blue-400" />
        <Card label="Attendance Recorded"  value={d.sessionsWithAttendance}    href="/admin/sessions"     color="bg-emerald-400" />
        <Card label="Missing Attendance"   value={d.sessionsMissingAttendance} href="/admin/sessions?missing=1" color="bg-red-400" alert />
        <Card label="New Leads Today"      value={d.leadsToday}                href="/admin/leads"        color="bg-violet-400" />
        <Card label="Converted Today"      value={d.leadsConvertedToday}       href="/admin/leads"        color="bg-teal-400" />
        <Card label="Active Students"      value={d.activeStudents}            href="/admin/students"     color="bg-[#FF8A1F]" />
        <Card label="Overdue Follow-Ups"   value={d.overdueFollowUps}          href="/admin/leads"        color="bg-amber-400" alert />
        <Card label="Certs This Month"     value={d.certsIssuedThisMonth}      href="/admin/certificates" color="bg-sky-400" />
      </div>

      {/* ── THIS MONTH ───────────────────────────────────────────────────── */}
      <Section title={`${monthName}`} sub="Monthly indicators" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="New Students"        value={d.newStudentsThisMonth}     href="/admin/students"  color="bg-emerald-400" />
        <Card label="Leads"               value={d.leadsThisMonth}           href="/admin/leads"     color="bg-violet-400" />
        <Card label="Converted"           value={d.leadsConvertedThisMonth}  href="/admin/leads"     color="bg-teal-400" />
        <Card
          label="Conversion Rate"
          value={`${d.conversionRateThisMonth}%`}
          href="/admin/leads"
          color={d.conversionRateThisMonth >= 30 ? 'bg-emerald-400' : d.conversionRateThisMonth >= 15 ? 'bg-amber-400' : 'bg-red-400'}
          sub={`${d.leadsConvertedThisMonth} of ${d.leadsThisMonth} leads`}
        />
      </div>

      {/* ── ACADEMY ──────────────────────────────────────────────────────── */}
      <Section title="Academy" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isSuperAdmin && <Card label="Branches"    value={d.totalBranches}    href="/admin/branches"    color="bg-[#FF8A1F]" />}
        <Card label="Active Groups"    value={d.totalGroups}      href="/admin/groups"      color="bg-blue-400" />
        <Card label="Instructors"      value={d.totalInstructors} href="/admin/instructors" color="bg-indigo-400" />
        <Card label="Active Students"  value={d.activeStudents}   href="/admin/students"    color="bg-emerald-400" />
      </div>

      {/* ── TOP PERFORMERS ───────────────────────────────────────────────── */}
      {(d.topBranch || d.topInstructor) && (
        <>
          <Section title="Top Performers" sub={`${monthName} highlights`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {d.topBranch && (
              <Link href={`/admin/branches/${d.topBranch.id}/performance`} className="group rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:shadow-sm hover:border-[#CBD5E1]">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Top Branch</p>
                <p className="font-semibold text-[#0B1F3A] group-hover:text-[#FF8A1F]">{d.topBranch.name}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{d.topBranch.students} active students</p>
              </Link>
            )}
            {d.topInstructor && (
              <Link href={`/admin/instructors/${d.topInstructor.id}`} className="group rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:shadow-sm hover:border-[#CBD5E1]">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Most Active Instructor</p>
                <p className="font-semibold text-[#0B1F3A] group-hover:text-[#FF8A1F]">{d.topInstructor.name}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{d.topInstructor.sessions} sessions recorded this month</p>
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── FINANCE ─────────────────────────────────────────────────────── */}
      {financeData && (
        <>
          <Section title="Finance" sub="Collections snapshot" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card
              label="Outstanding"
              value={`EGP ${new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(financeData.outstanding)}`}
              href="/admin/finance"
              color={financeData.outstanding > 0 ? 'bg-amber-400' : 'bg-emerald-400'}
            />
            <Card
              label="Collection Rate"
              value={`${financeData.collection_rate}%`}
              href="/admin/finance"
              color={financeData.collection_rate >= 80 ? 'bg-emerald-400' : financeData.collection_rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}
              sub={`${financeData.collected_this_month > 0 ? `EGP ${new Intl.NumberFormat('en-EG',{maximumFractionDigits:0}).format(financeData.collected_this_month)} collected this month` : 'No payments this month'}`}
            />
            <Card
              label="Overdue Students"
              value={financeData.overdue_count}
              href="/admin/finance?status=OVERDUE"
              color={financeData.overdue_count > 0 ? 'bg-red-400' : 'bg-slate-300'}
              alert
            />
            <Card
              label="Due This Week"
              value={financeData.due_this_week}
              href="/admin/finance/queue"
              color={financeData.due_this_week > 0 ? 'bg-amber-400' : 'bg-slate-300'}
            />
          </div>
          {(financeData.broken_promises > 0 || financeData.overdue_count > 0) && (
            <div className="space-y-2">
              <Alert
                href="/admin/finance?status=OVERDUE"
                label="Students with overdue balances — immediate follow-up needed"
                count={financeData.overdue_count}
                level="critical"
                icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /></svg>}
              />
              {financeData.broken_promises > 0 && (
                <Alert
                  href="/admin/finance"
                  label="Broken payment promises — parents did not pay as promised"
                  count={financeData.broken_promises}
                  level="warning"
                  icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ── ALERTS ───────────────────────────────────────────────────────── */}
      <Section title="Alerts" sub="Items requiring action" />
      <div className="space-y-2">
        <Alert href="/admin/system-health" label="Groups without instructor assigned"           count={d.groupsWithoutInstructor} level="critical" icon={IcoAlert}   />
        <Alert href="/admin/system-health" label="Groups without active course"                 count={d.groupsWithoutCourse}     level="critical" icon={IcoBook}    />
        <Alert href="/admin/leads"         label="Overdue lead follow-ups"                      count={d.overdueFollowUps}        level="warning"  icon={IcoClock}   />
        <Alert href="/admin/leads"         label="Leads stuck in pipeline (7+ days same stage)" count={d.leadsStuck}              level="warning"  icon={IcoClock}   />
        <Alert href="/admin/system-health" label="Active students not enrolled in any group"    count={d.studentsWithoutGroup}    level="info"     icon={IcoStudent} />
        {totalAlerts === 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            No alerts — academy is operating normally.
          </div>
        )}
      </div>

      {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
      <Section title="Quick Actions" />
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin && (
            <Link href="/admin/branches/new" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">+ Branch</Link>
          )}
          {user.permissions.includes('manage_groups') && (
            <Link href="/admin/groups/new" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">+ Group</Link>
          )}
          {user.permissions.includes('manage_instructors') && (
            <Link href="/admin/instructors/new" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">+ Instructor</Link>
          )}
          {user.permissions.includes('manage_students') && (
            <Link href="/admin/students/new" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">+ Student</Link>
          )}
          <Link href="/admin/leads" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">View Leads</Link>
          {user.permissions.includes('manage_financials') && (
            <>
              <Link href="/admin/finance" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">Finance Center</Link>
              <Link href="/admin/finance/queue" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">Collections Queue</Link>
            </>
          )}
          {isSuperAdmin && (
            <>
              <Link href="/admin/system-health" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">System Health</Link>
              <Link href="/admin/analytics" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]">Analytics</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
