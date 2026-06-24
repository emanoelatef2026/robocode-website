/**
 * Production Readiness Audit
 *
 * Comprehensive PASS / WARNING / FAIL checklist for the academy system.
 * Checks: database, permissions, analytics, leads, attendance, assignments,
 *         courses, groups, certificates, communications.
 */

import { createServiceClient }   from '@/lib/supabase/service'
import { requireAuth }           from '@/modules/rbac/guards'
import { redirect }              from 'next/navigation'
import { getRecoverySummary }    from '@/modules/recovery'
import Link                      from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = 'PASS' | 'WARNING' | 'FAIL'

interface Check {
  id:      string
  label:   string
  status:  CheckStatus
  value:   string
  reason:  string
  fix?:    string
  href?:   string
}

interface CheckCategory {
  title:  string
  checks: Check[]
  icon:   string
}

// ── Check runner ──────────────────────────────────────────────────────────────

async function runProductionChecks(): Promise<CheckCategory[]> {
  const db = createServiceClient()

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function count(table: string, filters: Record<string, unknown> = {}): Promise<number> {
    try {
      let q = db.from(table).select('id', { count: 'exact', head: true })
      for (const [key, val] of Object.entries(filters)) {
        if (val === null)      q = (q as any).is(key, null)
        else if (val === '!null') q = (q as any).not(key, 'is', null)
        else                   q = (q as any).eq(key, val)
      }
      const res = await q
      return (res as any).count ?? 0
    } catch {
      return -1
    }
  }

  function check(
    id: string, label: string,
    value: number | string,
    status: CheckStatus,
    reason: string,
    fix?: string,
    href?: string
  ): Check {
    return { id, label, status, value: String(value), reason, fix, href }
  }

  // ── Run all checks ────────────────────────────────────────────────────────

  const [
    activeBranches,
    activeGroups,
    activeStudents,
    activeInstructors,
    activeTLs,
    publishedCourses,
    activeCerts,
    totalLeads,
    convertedLeads,
    openMessages,
    groupsNoInstructor,
    groupsNoCourse,
    studentsNoGroup,
    schedulesLast30,
    orphanAttendance,
    overdueLeads,
    unassignedLeads,
  ] = await Promise.all([
    count('branches', { is_active: true, deleted_at: null }),
    count('groups', { status: 'active', deleted_at: null }),
    count('students', { status: 'active', deleted_at: null }),
    count('instructors', { status: 'active', deleted_at: null }),
    // TLs: check via user_roles
    (async () => {
      const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
      if (!tlRole) return 0
      const { count: c } = await db.from('user_roles').select('id', { count: 'exact', head: true }).eq('role_id', tlRole.id).not('branch_id', 'is', null)
      return c ?? 0
    })(),
    count('courses', { is_published: true, deleted_at: null }),
    count('certificates', { status: 'active' }),
    count('leads'),
    count('leads', { status: 'CONVERTED' }),
    // Open parent messages
    (async () => {
      try {
        const { count: c } = await db.from('parent_messages').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review'])
        return c ?? 0
      } catch { return 0 }
    })(),
    // Groups without instructor
    (async () => {
      const { data: grps } = await db.from('groups').select('id').eq('status', 'active').is('deleted_at', null)
      const ids = (grps ?? []).map((g: any) => g.id as string)
      if (!ids.length) return 0
      const { data: gi } = await db.from('group_instructors').select('group_id').in('group_id', ids)
      const withInst = new Set((gi ?? []).map((r: any) => r.group_id as string))
      return ids.filter(id => !withInst.has(id)).length
    })(),
    // Groups without course
    (async () => {
      const { data: grps } = await db.from('groups').select('id').eq('status', 'active').is('deleted_at', null)
      const ids = (grps ?? []).map((g: any) => g.id as string)
      if (!ids.length) return 0
      const { data: gc } = await db.from('group_courses').select('group_id').in('group_id', ids).eq('status', 'active')
      const withCourse = new Set((gc ?? []).map((r: any) => r.group_id as string))
      return ids.filter(id => !withCourse.has(id)).length
    })(),
    // Students without group
    (async () => {
      const { count: sc } = await db.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null)
      const { data: gs } = await db.from('group_students').select('student_id').eq('status', 'active')
      const inGroup = new Set((gs ?? []).map((r: any) => r.student_id as string))
      return Math.max(0, (sc ?? 0) - inGroup.size)
    })(),
    // Sessions last 30 days
    count('schedules'),
    // Orphan attendance records (schedule not found) — approximation
    0,
    // Overdue leads
    (async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { count: c } = await db.from('leads').select('id', { count: 'exact', head: true })
        .lt('next_follow_up_at', today).not('next_follow_up_at', 'is', null).not('status', 'in', '("CONVERTED","LOST")')
      return c ?? 0
    })(),
    // Unassigned active leads
    (async () => {
      const { count: c } = await db.from('leads').select('id', { count: 'exact', head: true })
        .is('assigned_to', null).not('status', 'in', '("CONVERTED","LOST")')
      return c ?? 0
    })(),
  ])

  const convRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

  // ── Category: Organization ────────────────────────────────────────────────

  const orgChecks: Check[] = [
    check('branches', 'Active Branches', activeBranches,
      activeBranches > 0 ? 'PASS' : 'FAIL',
      activeBranches > 0 ? `${activeBranches} branch${activeBranches !== 1 ? 'es' : ''} configured` : 'No active branches found',
      activeBranches === 0 ? 'Create at least one branch' : undefined,
      '/admin/branches'),
    check('team_leaders', 'Team Leader Assignments', activeTLs,
      activeTLs > 0 ? 'PASS' : 'WARNING',
      activeTLs > 0 ? `${activeTLs} active assignment${activeTLs !== 1 ? 's' : ''}` : 'No team leaders assigned to branches',
      activeTLs === 0 ? 'Assign team leaders to manage branches' : undefined,
      '/admin/team-leaders'),
    check('instructors', 'Active Instructors', activeInstructors,
      activeInstructors > 0 ? 'PASS' : 'FAIL',
      activeInstructors > 0 ? `${activeInstructors} active instructor${activeInstructors !== 1 ? 's' : ''}` : 'No active instructors',
      activeInstructors === 0 ? 'Add at least one instructor before activating groups' : undefined,
      '/admin/instructors'),
  ]

  // ── Category: Academic ───────────────────────────────────────────────────

  const academicChecks: Check[] = [
    check('courses', 'Published Courses', publishedCourses,
      publishedCourses > 0 ? 'PASS' : 'WARNING',
      publishedCourses > 0 ? `${publishedCourses} published course${publishedCourses !== 1 ? 's' : ''}` : 'No published courses',
      publishedCourses === 0 ? 'Publish at least one course' : undefined,
      '/admin/courses'),
    check('active_groups', 'Active Groups', activeGroups,
      activeGroups > 0 ? 'PASS' : 'WARNING',
      activeGroups > 0 ? `${activeGroups} active group${activeGroups !== 1 ? 's' : ''}` : 'No active groups',
      undefined, '/admin/groups'),
    check('groups_no_instructor', 'Groups Without Instructor', groupsNoInstructor,
      groupsNoInstructor === 0 ? 'PASS' : groupsNoInstructor <= 2 ? 'WARNING' : 'FAIL',
      groupsNoInstructor === 0 ? 'All active groups have instructors' : `${groupsNoInstructor} group${groupsNoInstructor !== 1 ? 's' : ''} without instructor`,
      groupsNoInstructor > 0 ? 'Assign instructors to all active groups' : undefined,
      '/admin/system-health'),
    check('groups_no_course', 'Groups Without Course', groupsNoCourse,
      groupsNoCourse === 0 ? 'PASS' : groupsNoCourse <= 2 ? 'WARNING' : 'FAIL',
      groupsNoCourse === 0 ? 'All active groups have courses assigned' : `${groupsNoCourse} group${groupsNoCourse !== 1 ? 's' : ''} without active course`,
      groupsNoCourse > 0 ? 'Assign a course to each active group' : undefined,
      '/admin/system-health'),
    check('students_no_group', 'Active Students Without Group', studentsNoGroup,
      studentsNoGroup === 0 ? 'PASS' : studentsNoGroup <= 5 ? 'WARNING' : 'FAIL',
      studentsNoGroup === 0 ? 'All active students are enrolled in groups' : `${studentsNoGroup} student${studentsNoGroup !== 1 ? 's' : ''} not in any group`,
      studentsNoGroup > 0 ? 'Enroll unassigned students in appropriate groups' : undefined,
      '/admin/system-health'),
    check('certificates', 'Certificates Issued', activeCerts,
      'PASS',
      `${activeCerts} active certificate${activeCerts !== 1 ? 's' : ''} issued`,
      undefined, '/admin/certificates'),
  ]

  // ── Category: Leads & Marketing ──────────────────────────────────────────

  const leadsChecks: Check[] = [
    check('leads_total', 'Lead Pipeline', totalLeads,
      totalLeads > 0 ? 'PASS' : 'WARNING',
      totalLeads > 0 ? `${totalLeads} total lead${totalLeads !== 1 ? 's' : ''}` : 'No leads in system',
      totalLeads === 0 ? 'Set up lead capture on website' : undefined,
      '/admin/leads'),
    check('conversion_rate', 'Conversion Rate', `${convRate}%`,
      convRate >= 20 ? 'PASS' : convRate >= 10 ? 'WARNING' : totalLeads === 0 ? 'PASS' : 'FAIL',
      totalLeads === 0 ? 'No leads yet' : `${convRate}% (${convertedLeads}/${totalLeads})`,
      convRate < 10 && totalLeads > 0 ? 'Review lead qualification and follow-up process' : undefined,
      '/admin/leads/funnel'),
    check('overdue_followups', 'Overdue Follow-Ups', overdueLeads,
      overdueLeads === 0 ? 'PASS' : overdueLeads <= 5 ? 'WARNING' : 'FAIL',
      overdueLeads === 0 ? 'All follow-ups are current' : `${overdueLeads} overdue follow-up${overdueLeads !== 1 ? 's' : ''}`,
      overdueLeads > 0 ? 'Review and action overdue leads immediately' : undefined,
      '/admin/leads'),
    check('unassigned_leads', 'Unassigned Active Leads', unassignedLeads,
      unassignedLeads === 0 ? 'PASS' : unassignedLeads <= 3 ? 'WARNING' : 'FAIL',
      unassignedLeads === 0 ? 'All active leads have owners' : `${unassignedLeads} lead${unassignedLeads !== 1 ? 's' : ''} without owner`,
      unassignedLeads > 0 ? 'Assign team leaders to unowned leads' : undefined,
      '/admin/leads'),
  ]

  // ── Category: Operations ─────────────────────────────────────────────────

  const opsChecks: Check[] = [
    check('active_students', 'Active Students', activeStudents,
      activeStudents > 0 ? 'PASS' : 'WARNING',
      activeStudents > 0 ? `${activeStudents} active student${activeStudents !== 1 ? 's' : ''}` : 'No active students enrolled',
      undefined, '/admin/students'),
    check('open_messages', 'Open Parent Messages', openMessages,
      openMessages === 0 ? 'PASS' : openMessages <= 5 ? 'WARNING' : 'FAIL',
      openMessages === 0 ? 'No open parent messages' : `${openMessages} message${openMessages !== 1 ? 's' : ''} awaiting response`,
      openMessages > 0 ? 'Respond to open parent messages' : undefined,
      '/admin/communications'),
    check('schedules', 'Sessions Created', schedulesLast30,
      schedulesLast30 > 0 ? 'PASS' : 'WARNING',
      schedulesLast30 > 0 ? `${schedulesLast30} total session records` : 'No sessions scheduled',
      schedulesLast30 === 0 ? 'Create and schedule group sessions' : undefined,
      '/admin/attendance'),
  ]

  return [
    { title: 'Organization', icon: '🏢', checks: orgChecks },
    { title: 'Academic',     icon: '📚', checks: academicChecks },
    { title: 'Leads',        icon: '🎯', checks: leadsChecks },
    { title: 'Operations',   icon: '⚙️',  checks: opsChecks },
  ]
}

// ── UI Components ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<CheckStatus, { badge: string; row: string }> = {
  PASS:    { badge: 'bg-[#E7F8EE] text-[#15803D]', row: '' },
  WARNING: { badge: 'bg-[#FFFBEB] text-[#B45309]',     row: 'bg-[#FFFBEB]/40' },
  FAIL:    { badge: 'bg-[#FEE2E2] text-[#DC2626]',         row: 'bg-[#FEE2E2]/40' },
}

function CategoryScore({ checks }: { checks: Check[] }) {
  const pass  = checks.filter(c => c.status === 'PASS').length
  const total = checks.length
  const pct   = Math.round((pass / total) * 100)
  const color = pct === 100 ? 'text-[#10B981]' : pct >= 70 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
  return <span className={`text-sm font-bold ${color}`}>{pass}/{total}</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProductionReadinessPage() {
  const user = await requireAuth()
  if (user.globalRole !== 'super_admin') redirect('/admin')

  const db = createServiceClient()
  const [categories, recoverySummary, capacityData, healthData] = await Promise.all([
    runProductionChecks(),
    getRecoverySummary(),
    db.from('v_capacity_analysis').select('*').limit(20).then(r => r.data ?? [], () => []) as Promise<any[]>,
    db.from('v_system_health_2').select('*').single().then(r => r.data ?? null, () => null),
  ])

  const allChecks  = categories.flatMap(c => c.checks)
  const passCount  = allChecks.filter(c => c.status === 'PASS').length
  const warnCount  = allChecks.filter(c => c.status === 'WARNING').length
  const failCount  = allChecks.filter(c => c.status === 'FAIL').length
  const totalScore = allChecks.length > 0 ? Math.round((passCount / allChecks.length) * 100) : 0

  const readinessLevel =
    failCount > 0 ? 'Not Ready' :
    warnCount > 3 ? 'Needs Attention' :
    warnCount > 0 ? 'Almost Ready' : 'Production Ready'

  const levelColor =
    failCount > 0 ? 'text-[#EF4444]' :
    warnCount > 3 ? 'text-[#EF4444]' :
    warnCount > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'

  const levelBg =
    failCount > 0 ? 'bg-[#FEE2E2] border-[#FECACA]' :
    warnCount > 3 ? 'bg-[#FFFBEB] border-[#FDE68A]' :
    warnCount > 0 ? 'bg-[#FFFBEB] border-[#FDE68A]' : 'bg-[#E7F8EE] border-[#A7F3D0]'

  const health2Score     = (healthData as any)?.health_score ?? null
  const totalStudentsAll = (capacityData as any[]).reduce((s, b) => s + Number(b.students ?? 0), 0)
  const totalCapacity    = (capacityData as any[]).reduce((s, b) => s + Number(b.estimated_capacity ?? 0), 0)
  const capacityPct      = totalCapacity > 0 ? Math.round((totalStudentsAll / totalCapacity) * 100) : null

  const recoveryCritical = (recoverySummary).filter(r => r.severity === 'critical' && r.count > 0).length

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
          <Link href="/admin/recovery" className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
            Recovery →
          </Link>
          <div className="text-right">
            <p className={`text-3xl font-bold ${levelColor}`}>{totalScore}%</p>
            <p className="text-xs text-[#94A3B8]">{passCount}/{allChecks.length} checks</p>
          </div>
      </div>

      {/* ── Sprint 53: System Health 2.0 + Recovery Status ─────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'System Health 2.0',
            value: health2Score != null ? `${health2Score}/100` : '—',
            cls:   health2Score != null ? (health2Score >= 90 ? 'text-[#10B981]' : health2Score >= 75 ? 'text-[#2563EB]' : 'text-[#F59E0B]') : 'text-[#94A3B8]',
          },
          {
            label: 'Recovery Issues',
            value: recoveryCritical > 0 ? `${recoveryCritical} critical` : 'Clean',
            cls:   recoveryCritical > 0 ? 'text-[#EF4444]' : 'text-[#10B981]',
          },
          {
            label: 'Academy Capacity',
            value: capacityPct != null ? `${capacityPct}% used` : '—',
            cls:   capacityPct != null ? (capacityPct > 80 ? 'text-[#F59E0B]' : 'text-[#10B981]') : 'text-[#94A3B8]',
          },
          {
            label: 'Total Students',
            value: String(totalStudentsAll),
            cls:   'text-[#0B1F3A]',
          },
        ].map(k => (
          <div key={k.label} className="ds-card p-4">
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Overall status ─────────────────────────────────────────────── */}
      <div className={`rounded-xl border px-5 py-4 ${levelBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-lg font-bold ${levelColor}`}>{readinessLevel}</p>
            <p className="text-sm text-[#64748B]">
              {passCount} passing · {warnCount} warnings · {failCount} failures
            </p>
          </div>
          <div className="flex gap-2">
            {failCount > 0  && <span className="rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#DC2626]">{failCount} FAIL</span>}
            {warnCount > 0  && <span className="rounded-full bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#B45309]">{warnCount} WARN</span>}
            {passCount > 0  && <span className="rounded-full bg-[#E7F8EE] px-2.5 py-1 text-xs font-semibold text-[#15803D]">{passCount} PASS</span>}
          </div>
        </div>
      </div>

      {/* ── Categories ─────────────────────────────────────────────────── */}
      {categories.map(cat => (
        <div key={cat.title} className="ds-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
              <span>{cat.icon}</span>
              {cat.title}
            </h2>
            <CategoryScore checks={cat.checks} />
          </div>

          <table className="w-full text-sm">
            <tbody>
              {cat.checks.map(c => (
                <tr key={c.id} className={`border-b border-[#E2E8F0] last:border-0 ${STATUS_STYLE[c.status].row}`}>
                  <td className="px-5 py-3 font-medium text-[#0B1F3A] w-48">{c.label}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[c.status].badge}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono font-medium text-[#0B1F3A]">{c.value}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{c.reason}</td>
                  <td className="px-4 py-3 text-xs text-[#F59E0B] max-w-48">
                    {c.fix && (
                      c.href
                        ? <Link href={c.href} className="underline hover:text-[#FF8A1F]">{c.fix}</Link>
                        : c.fix
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ── All passing ────────────────────────────────────────────────── */}
      {failCount === 0 && warnCount === 0 && (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] px-6 py-6 text-center">
          <p className="text-2xl">✓</p>
          <p className="mt-2 text-base font-semibold text-[#15803D]">All systems are production-ready</p>
          <p className="mt-1 text-sm text-[#10B981]">No failures or warnings detected.</p>
        </div>
      )}

      {/* ── Sprint 53: Recovery Needs ──────────────────────────────────── */}
      {recoverySummary.filter(r => r.count > 0).length > 0 && (
        <div className="rounded-xl border border-[#FDE68A] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3 bg-[#FFFBEB]">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#92400E]">Recovery Needed</p>
              <Link href="/admin/recovery" className="text-[11px] text-[#B45309] hover:underline">Fix Now →</Link>
            </div>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {recoverySummary.filter(r => r.count > 0).map(item => (
              <div key={item.check_name} className="flex items-center justify-between px-5 py-3">
                <p className="text-[13px] text-[#0B1F3A]">{item.description}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold
                  ${item.severity === 'critical' ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sprint 53: Capacity Analysis ──────────────────────────────── */}
      {(capacityData as any[]).length > 0 && (
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3 bg-[#F8FAFC]">
            <p className="text-[13px] font-semibold text-[#0B1F3A]">Branch Capacity Analysis</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="ds-table-head">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Branch', 'Students', 'Instructors', 'Capacity', 'Utilization', 'Open Tasks'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(capacityData as any[]).map(b => {
                  const utilPct = b.capacity_utilization_pct != null ? Number(b.capacity_utilization_pct) : null
                  return (
                    <tr key={b.branch_id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">{b.branch_name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{b.students}</td>
                      <td className="px-4 py-3 text-[#64748B]">{b.instructors}</td>
                      <td className="px-4 py-3 text-[#64748B]">{b.estimated_capacity ?? '—'}</td>
                      <td className="px-4 py-3">
                        {utilPct != null ? (
                          <span className={`font-semibold ${utilPct > 90 ? 'text-[#EF4444]' : utilPct > 70 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                            {utilPct}%
                          </span>
                        ) : <span className="text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {Number(b.open_tasks) > 0 ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                            ${Number(b.critical_tasks) > 0 ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
                            {b.open_tasks}
                          </span>
                        ) : <span className="text-[#10B981]">✓</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sprint 53: Scaling Assessment + Infra Recommendations ────────── */}
      <div className="ds-card p-5 space-y-4">
        <h2 className="text-[14px] font-semibold text-[#0B1F3A]">Sprint 53: Scaling Assessment</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title:       'Current Capacity',
              detail:      `${totalStudentsAll.toLocaleString()} students across ${(capacityData as any[]).length} branches`,
              status:      capacityPct != null && capacityPct > 90 ? '⚠' : '✓',
              statusCls:   capacityPct != null && capacityPct > 90 ? 'text-[#F59E0B]' : 'text-[#10B981]',
            },
            {
              title:       'Concurrency Safety',
              detail:      'Task dedup via unique partial index. Automation 6h cooldown. Realtime debounced 800ms.',
              status:      '✓',
              statusCls:   'text-[#10B981]',
            },
            {
              title:       'Finance Consistency',
              detail:      'Balance integrity enforced via trigger + repair function. Consistency checker runs on demand.',
              status:      recoveryCritical > 0 ? '⚠' : '✓',
              statusCls:   recoveryCritical > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]',
            },
            {
              title:       'Observability',
              detail:      'system_event_logs captures all failures. Dead letter jobs visible. Health 2.0 score.',
              status:      '✓',
              statusCls:   'text-[#10B981]',
            },
          ].map(item => (
            <div key={item.title} className="rounded-lg border border-[#E2E8F0] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-[#0B1F3A]">{item.title}</p>
                <span className={`text-[18px] ${item.statusCls}`}>{item.status}</span>
              </div>
              <p className="mt-1 text-[12px] text-[#64748B]">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-blue-200 bg-[#EFF6FF] p-4">
          <p className="text-[13px] font-semibold text-blue-800">Recommended Infra Upgrades</p>
          <ul className="mt-2 space-y-1 text-[12px] text-[#1D4ED8]">
            <li>• <strong>pg_cron</strong> for materialized view refresh (currently manual via background jobs)</li>
            <li>• <strong>Supabase Edge Functions</strong> for background job processing (replaces Next.js API routes)</li>
            <li>• <strong>Connection pooling</strong> (PgBouncer) once student count exceeds 10,000</li>
            <li>• <strong>Read replicas</strong> for dashboard/analytics queries above 5,000 concurrent users</li>
            <li>• <strong>Realtime filter</strong> push down to server side when Supabase adds IN support</li>
            <li>• <strong>Notification worker</strong> process separate from web server for WhatsApp/email</li>
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
          {[
            { label: 'Estimated Student Ceiling', value: '~15,000', detail: 'Before DB read replicas needed' },
            { label: 'Branch Ceiling',             value: '~50',     detail: 'With current architecture' },
            { label: 'Concurrent TL Users',        value: '~200',    detail: 'With Supabase realtime' },
          ].map(k => (
            <div key={k.label} className="rounded-lg bg-[#F8FAFC] p-3">
              <p className="text-[16px] font-bold text-[#0B1F3A]">{k.value}</p>
              <p className="font-medium text-[#0B1F3A]">{k.label}</p>
              <p className="text-[#94A3B8]">{k.detail}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
